#!/usr/bin/env bun
// Interactive setup for the OpenCode web app in Docker. Asks for every value with a sensible default, generates the
// server password, and writes hosting/.env so `docker compose` needs nothing typed by hand.
//
//   bun hosting/setup.ts          interactive
//   bun hosting/setup.ts --yes    accept every default (for scripts and the appliance image)

import { randomBytes } from "node:crypto"
import { networkInterfaces } from "node:os"
import path from "node:path"
import { createInterface } from "node:readline/promises"

const file = path.join(import.meta.dir, ".env")
const yes = process.argv.includes("--yes")
const existing = await readEnv(file)
const rl = yes ? undefined : createInterface({ input: process.stdin, output: process.stdout })

const bold = (text: string) => `\x1b[1m${text}\x1b[0m`
const dim = (text: string) => `\x1b[2m${text}\x1b[0m`
const accent = (text: string) => `\x1b[38;2;208;188;255m${text}\x1b[0m`

console.log(`\n${accent("●")} ${bold("Material OpenCode — web app in Docker setup")}`)
console.log(dim("Press Enter to keep the value in brackets.\n"))

const steps = [
  { key: "OPENCODE_INSTANCE", label: "Instance name (container and volume name)", fallback: "material-opencode" },
  { key: "OPENCODE_PORT", label: "Port on this computer", fallback: "4096", check: (value: string) => /^\d{2,5}$/.test(value) && Number(value) < 65536 },
  { key: "OPENCODE_BIND", label: "Listen address (0.0.0.0 = whole local network)", fallback: "0.0.0.0" },
  { key: "OPENCODE_WORKSPACE", label: "Folder with your projects (mounted at /workspace)", fallback: path.resolve(import.meta.dir, "workspace") },
  { key: "OPENCODE_IMAGE", label: "Image (published, or a local build tag)", fallback: "ghcr.io/ding-ding-projects/material-opencode:latest" },
] as const

const answers: Record<string, string> = {}
for (const [index, step] of steps.entries()) {
  const current = existing[step.key] ?? step.fallback
  const value = await ask(`${dim(`${index + 1}/${steps.length + 1}`)} ${step.label} [${current}]: `, current)
  if ("check" in step && !step.check(value)) {
    console.log(`  ${bold("!")} ${value} is not valid, keeping ${current}`)
    answers[step.key] = current
    continue
  }
  answers[step.key] = value
}

const keep = existing.OPENCODE_PASSWORD
  ? (await ask(`${dim(`${steps.length + 1}/${steps.length + 1}`)} Keep the existing server password? [Y/n]: `, "y")).toLowerCase() !== "n"
  : false
answers.OPENCODE_PASSWORD = keep ? existing.OPENCODE_PASSWORD! : randomBytes(24).toString("base64url")
rl?.close()

await Bun.write(
  file,
  ["# Written by hosting/setup.ts. Keep this file private: it holds the server password.", ...Object.entries(answers).map(([key, value]) => `${key}=${value}`), ""].join("\n"),
  { mode: 0o600 },
)
await Bun.$`mkdir -p ${answers.OPENCODE_WORKSPACE}`.quiet().nothrow()

const lan = Object.values(networkInterfaces())
  .flat()
  .find((entry) => entry && entry.family === "IPv4" && !entry.internal)?.address
console.log(`\n${accent("✓")} Wrote ${path.relative(process.cwd(), file)}`)
console.log(`  Start it:  ${bold(process.platform === "win32" ? "hosting\\host.bat" : "hosting/host.sh")}`)
console.log(`  Open:      ${bold(`http://${lan ?? "localhost"}:${answers.OPENCODE_PORT}`)}  ${dim("(use the password from hosting/.env)")}\n`)

async function ask(question: string, fallback: string) {
  if (!rl) return fallback
  const answer = (await rl.question(question)).trim()
  return answer === "" ? fallback : answer
}

async function readEnv(target: string) {
  const text = await Bun.file(target).text().catch(() => "")
  return Object.fromEntries(
    text
      .split("\n")
      .filter((line) => line.includes("=") && !line.startsWith("#"))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  ) as Record<string, string>
}
