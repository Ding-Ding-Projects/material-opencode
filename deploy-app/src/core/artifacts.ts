import { createHash } from "node:crypto"
import { createReadStream, createWriteStream, existsSync } from "node:fs"
import { mkdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { createGunzip } from "node:zlib"
import type { Log } from "./system"

export const repository = "Ding-Ding-Projects/material-opencode"
export const imageName = "ghcr.io/ding-ding-projects/material-opencode"

export type Release = { tag: string; name: string; published: string; assets: { name: string; url: string; size: number }[] }

/** Image files a release publishes; the app picks one per target. All are gzip-compressed raw disk formats. */
export const applianceAssets = {
  usb: "material-opencode-x86_64.img.gz",
  virtualbox: "material-opencode-x86_64.vdi.gz",
  vmware: "material-opencode-x86_64.vmdk.gz",
  pi: "material-opencode-aarch64-pi.img.gz",
} as const

export async function latestRelease(): Promise<Release> {
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
    headers: { accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Could not read the latest release (${response.status})`)
  const body = (await response.json()) as {
    tag_name: string
    name: string
    published_at: string
    assets: { name: string; browser_download_url: string; size: number }[]
  }
  return {
    tag: body.tag_name,
    name: body.name,
    published: body.published_at,
    assets: body.assets.map((asset) => ({ name: asset.name, url: asset.browser_download_url, size: asset.size })),
  }
}

/**
 * Downloads a release asset into the cache, checks it against the release's SHA256SUMS, and expands it.
 * A cached file that still matches its checksum is reused.
 */
export async function fetchAsset(release: Release, name: string, cache: string, log: Log, progress: (fraction: number) => void) {
  const asset = release.assets.find((entry) => entry.name === name)
  if (!asset) throw new Error(`Release ${release.tag} has no ${name}`)
  const sums = release.assets.find((entry) => entry.name === "SHA256SUMS")
  const expected = sums ? await fetch(sums.url).then((response) => response.text()).then((text) => checksumFor(text, name)) : undefined
  const folder = path.join(cache, release.tag)
  await mkdir(folder, { recursive: true })
  const compressed = path.join(folder, name)

  const cached = existsSync(compressed) && expected !== undefined && (await sha256(compressed)) === expected
  if (!cached) {
    log(`Downloading ${name} (${Math.round(asset.size / 1e6)} MB)`)
    const response = await fetch(asset.url)
    if (!response.ok || !response.body) throw new Error(`Download of ${name} failed (${response.status})`)
    let received = 0
    const counter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength
        progress(received / asset.size)
        controller.enqueue(chunk)
      },
    })
    await pipeline(Readable.fromWeb(response.body.pipeThrough(counter) as never), createWriteStream(compressed))
  }
  if (expected !== undefined) {
    const actual = await sha256(compressed)
    if (actual !== expected) throw new Error(`${name} failed its checksum: expected ${expected}, got ${actual}`)
    log(`${name} matches its published checksum`)
  }
  if (expected === undefined) log(`Release ${release.tag} publishes no checksum for ${name}; it was not verified`)

  const expanded = compressed.replace(/\.gz$/, "")
  if (!existsSync(expanded) || (await stat(expanded)).mtimeMs < (await stat(compressed)).mtimeMs) {
    log(`Expanding ${name}`)
    await pipeline(createReadStream(compressed), createGunzip(), createWriteStream(expanded))
  }
  return expanded
}

export async function sha256(file: string) {
  const hash = createHash("sha256")
  await pipeline(createReadStream(file), hash)
  return hash.digest("hex")
}

function checksumFor(sums: string, name: string) {
  return sums
    .split("\n")
    .map((line) => line.trim().split(/\s+\*?/))
    .find((parts) => parts[1] === name)?.[0]
}

/** The source snapshot packed into this app at build time, and the commit it came from. */
export async function bundledSource(resources: string) {
  const archive = path.join(resources, "source.tar.gz")
  const info = path.join(resources, "source.json")
  if (!existsSync(archive) || !existsSync(info)) return undefined
  const meta = JSON.parse(await readFile(info, "utf8")) as { commit: string; sha256: string; built: string }
  return { archive, ...meta }
}
