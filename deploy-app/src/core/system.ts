import { spawn } from "node:child_process"
import { createServer } from "node:net"
import { networkInterfaces } from "node:os"

export type Log = (line: string) => void

/** Runs a program without a shell, streaming its output to the log, and fails with its exit code and last lines. */
export function run(command: string, args: readonly string[], log: Log, options: { cwd?: string; input?: string } = {}) {
  return new Promise<string>((resolve, reject) => {
    log(`$ ${command} ${args.join(" ")}`)
    const child = spawn(command, [...args], { cwd: options.cwd, windowsHide: true })
    const lines: string[] = []
    const take = (chunk: Buffer) =>
      chunk
        .toString()
        .split(/\r?\n/)
        .filter((line) => line.trim() !== "")
        .forEach((line) => {
          lines.push(line)
          log(line)
        })
    child.stdout.on("data", take)
    child.stderr.on("data", take)
    child.on("error", (error) => reject(new Error(`${command} could not start: ${error.message}`)))
    child.on("close", (code) =>
      code === 0 ? resolve(lines.join("\n")) : reject(new Error(`${command} exited with ${code}: ${lines.slice(-5).join(" ")}`)),
    )
    if (options.input !== undefined) child.stdin.end(options.input)
  })
}

/** Version text of a tool, or undefined when it is not installed. */
export async function probe(command: string, args: readonly string[]) {
  return run(command, args, () => {})
    .then((output) => output.split("\n")[0]?.trim() || "installed")
    .catch(() => undefined)
}

/** The first non-internal IPv4 address, which is how other devices on the network reach this computer. */
export function lanAddress() {
  return Object.values(networkInterfaces())
    .flat()
    .find((entry) => entry !== undefined && entry.family === "IPv4" && !entry.internal)?.address
}

export function portFree(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = createServer()
    server.once("error", () => resolve(false))
    server.listen(port, "0.0.0.0", () => server.close(() => resolve(true)))
  })
}

export async function freePort(start: number, taken: readonly number[]) {
  const candidates = Array.from({ length: 200 }, (_, offset) => start + offset).filter((port) => !taken.includes(port))
  for (const port of candidates) if (await portFree(port)) return port
  throw new Error(`No free port between ${start} and ${start + 199}`)
}

/** Polls a URL until it answers with a page, within a bounded time. The app returns its sign-in page without a password. */
export async function waitHealthy(url: string, log: Log, timeoutMs = 600_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const status = await fetch(url, { signal: AbortSignal.timeout(5000) })
      .then((response) => response.status)
      .catch(() => 0)
    if (status >= 200 && status < 500) {
      log(`${url} answered with ${status}`)
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
  throw new Error(`${url} did not answer within ${Math.round(timeoutMs / 60000)} minutes`)
}

export function strongPassword() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url")
}
