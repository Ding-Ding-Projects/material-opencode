import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { sha256 } from "./artifacts"
import { run, type Log } from "./system"

export type Disk = { id: string; name: string; size: number; bus: string }

/**
 * Removable disks only. The system disk, the boot disk and any disk holding the running system are never listed,
 * and nothing is preselected: the person picks the exact disk.
 */
export async function removableDisks(log: Log): Promise<Disk[]> {
  if (process.platform === "win32") {
    const json = await run(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-Disk | Where-Object { $_.BusType -in 'USB','SD','MMC' -and -not $_.IsBoot -and -not $_.IsSystem } | Select-Object Number,FriendlyName,Size,BusType | ConvertTo-Json -Compress",
      ],
      log,
    )
    const parsed = json.trim() === "" ? [] : (JSON.parse(json) as WindowsDisk | WindowsDisk[])
    return (Array.isArray(parsed) ? parsed : [parsed]).map((disk) => ({
      id: String(disk.Number),
      name: disk.FriendlyName,
      size: disk.Size,
      bus: disk.BusType,
    }))
  }
  if (process.platform === "linux") return parseLsblk(await run("lsblk", ["-J", "-b", "-o", "NAME,SIZE,RM,TRAN,MODEL,TYPE,MOUNTPOINTS"], log))
  return []
}

type WindowsDisk = { Number: number; FriendlyName: string; Size: number; BusType: string }

type LsblkDevice = {
  name: string
  size: number
  rm: boolean
  tran: string | null
  model: string | null
  type: string
  mountpoints: (string | null)[]
  children?: LsblkDevice[]
}

export function parseLsblk(json: string): Disk[] {
  const devices = (JSON.parse(json) as { blockdevices: LsblkDevice[] }).blockdevices
  const mounts = (device: LsblkDevice): string[] => [
    ...device.mountpoints.filter((mount): mount is string => mount !== null),
    ...(device.children ?? []).flatMap(mounts),
  ]
  return devices
    .filter((device) => device.type === "disk")
    .filter((device) => device.rm || device.tran === "usb" || device.tran === "mmc")
    .filter((device) => !mounts(device).some((mount) => mount === "/" || mount === "/boot" || mount === "/boot/efi" || mount === "[SWAP]"))
    .map((device) => ({ id: `/dev/${device.name}`, name: device.model?.trim() || device.name, size: device.size, bus: device.tran ?? "removable" }))
}

/**
 * Writes an image to a disk the person chose and confirmed, then reads the written bytes back and compares their
 * checksum with the image. Raw disk writes need administrator rights, so the write runs in a separate elevated helper
 * that asks through the system's own prompt; the app never handles a password.
 */
export async function flash(image: string, disk: Disk, log: Log, phase: (phase: "writing" | "verifying") => void) {
  const listed = await removableDisks(log)
  if (!listed.some((entry) => entry.id === disk.id && entry.size === disk.size))
    throw new Error(`${disk.name} is no longer attached as a removable disk; nothing was written`)
  const expected = await sha256(image)
  phase("writing")
  const work = await mkdtemp(path.join(tmpdir(), "mo-flash-"))
  const result = path.join(work, "readback.txt")
  if (process.platform === "win32") {
    const script = path.join(work, "flash.ps1")
    await writeFile(script, windowsFlash)
    await run(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${script}','-Image','${image}','-Disk','${disk.id}','-Result','${result}'`,
      ],
      log,
    )
  }
  if (process.platform === "linux") {
    const script = path.join(work, "flash.sh")
    await writeFile(script, linuxFlash, { mode: 0o700 })
    await run("pkexec", ["sh", script, image, disk.id, result], log)
  }
  phase("verifying")
  const readback = (await readFile(result, "utf8").catch(() => "")).trim().toLowerCase()
  if (readback !== expected) throw new Error(`Read-back check failed: the disk does not hold the image (${readback || "no result"})`)
  log(`${disk.name} holds the image; read-back checksum matches ${expected}`)
}

const linuxFlash = `#!/bin/sh
set -eu
image="$1"; disk="$2"; result="$3"
for part in $(lsblk -ln -o PATH "$disk" | tail -n +2); do umount "$part" 2>/dev/null || true; done
dd if="$image" of="$disk" bs=4M conv=fsync status=progress
sync
size=$(stat -c %s "$image")
head -c "$size" "$disk" | sha256sum | cut -d' ' -f1 > "$result"
`

const windowsFlash = `param([string]$Image, [int]$Disk, [string]$Result)
$ErrorActionPreference = 'Stop'
Get-Disk -Number $Disk | Get-Partition -ErrorAction SilentlyContinue | Where-Object DriveLetter | ForEach-Object { Remove-PartitionAccessPath -DiskNumber $Disk -PartitionNumber $_.PartitionNumber -AccessPath "$($_.DriveLetter):\\" }
Set-Disk -Number $Disk -IsOffline $true
$size = (Get-Item $Image).Length
$in = [IO.File]::OpenRead($Image)
$out = New-Object IO.FileStream("\\\\.\\PhysicalDrive$Disk", [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite)
$buffer = New-Object byte[] (4MB)
while (($read = $in.Read($buffer, 0, $buffer.Length)) -gt 0) {
  if ($read % 512 -ne 0) { [Array]::Clear($buffer, $read, 512 - ($read % 512)); $read += 512 - ($read % 512) }
  $out.Write($buffer, 0, $read)
}
$out.Flush(); $out.Close(); $in.Close()
$check = New-Object IO.FileStream("\\\\.\\PhysicalDrive$Disk", [IO.FileMode]::Open, [IO.FileAccess]::Read)
$sha = [Security.Cryptography.SHA256]::Create()
$left = $size
while ($left -gt 0) {
  $read = $check.Read($buffer, 0, [Math]::Min($buffer.Length, [Math]::Ceiling($left / 512) * 512))
  $use = [Math]::Min($read, $left)
  [void]$sha.TransformBlock($buffer, 0, $use, $null, 0)
  $left -= $use
}
[void]$sha.TransformFinalBlock(@(), 0, 0)
$check.Close()
Set-Disk -Number $Disk -IsOffline $false
([BitConverter]::ToString($sha.Hash) -replace '-', '').ToLower() | Set-Content -NoNewline $Result
`
