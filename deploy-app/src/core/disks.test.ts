import { expect, test } from "bun:test"
import { parseLsblk } from "./disks"

const disk = (name: string, extra: object) => ({ name, type: "disk", rm: false, size: 32e9, mountpoints: [null], ...extra })

test("lists only removable disks and never the system disk", () => {
  const output = JSON.stringify({
    blockdevices: [
      disk("nvme0n1", { tran: "nvme", children: [{ ...disk("nvme0n1p2", { type: "part" }), mountpoints: ["/"] }] }),
      disk("sda", { tran: "usb", model: " SanDisk Ultra " }),
      disk("mmcblk0", { tran: "mmc" }),
      disk("sdb", { tran: "usb", children: [{ ...disk("sdb1", { type: "part" }), mountpoints: ["[SWAP]"] }] }),
      { ...disk("loop0", { rm: true }), type: "loop" },
    ],
  })
  expect(parseLsblk(output)).toEqual([
    { id: "/dev/sda", name: "SanDisk Ultra", size: 32e9, bus: "usb" },
    { id: "/dev/mmcblk0", name: "mmcblk0", size: 32e9, bus: "mmc" },
  ])
})
