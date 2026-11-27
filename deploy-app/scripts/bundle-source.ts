// Packs the repository at HEAD into resources/source.tar.gz so the deploy app can build the web app with no download.
import { createHash } from "node:crypto"
import { mkdir } from "node:fs/promises"
import path from "node:path"

const root = path.resolve(import.meta.dir, "..", "..")
const out = path.resolve(import.meta.dir, "..", "resources")
await mkdir(out, { recursive: true })
const archive = path.join(out, "source.tar.gz")
const pack = Bun.spawnSync(["git", "-C", root, "archive", "--format=tar.gz", "--prefix=material-opencode/", "-o", archive, "HEAD"])
if (pack.exitCode !== 0) throw new Error(`git archive failed: ${pack.stderr.toString()}`)
const commit = Bun.spawnSync(["git", "-C", root, "rev-parse", "HEAD"]).stdout.toString().trim()
const sha256 = createHash("sha256").update(await Bun.file(archive).bytes()).digest("hex")
await Bun.write(path.join(out, "source.json"), JSON.stringify({ commit, sha256, built: new Date().toISOString() }, null, 2))
console.log(`source ${commit.slice(0, 12)} ${(Bun.file(archive).size / 1e6).toFixed(1)} MB sha256 ${sha256}`)
