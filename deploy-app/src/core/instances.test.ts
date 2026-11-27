import { expect, test } from "bun:test"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createRegistry } from "./instances"

test("records instances, refuses duplicates and picks free names", async () => {
  const registry = createRegistry(await mkdtemp(path.join(tmpdir(), "deploy-registry-")))
  const instance = { name: "opencode", target: "docker" as const, version: "1", port: 4096, url: "http://192.168.1.2:4096", folder: "/p", created: 1 }
  await registry.add(instance)
  expect(registry.add(instance)).rejects.toThrow("already exists")
  expect(await registry.uniqueName("OpenCode")).toBe("opencode-2")
  expect(await registry.uniqueName("My App!")).toBe("my-app")
  await registry.update("opencode", { health: { ok: true, at: 2 } })
  expect((await registry.list())[0]?.health).toEqual({ ok: true, at: 2 })
  await registry.remove("opencode")
  expect(await registry.list()).toEqual([])
})
