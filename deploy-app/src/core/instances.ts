import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

export type TargetKind = "docker" | "ssh" | "virtualbox" | "vmware"

export type Instance = {
  name: string
  target: TargetKind
  version: string
  port: number
  url: string
  folder: string
  sshHost?: string
  created: number
  /** Last health check result and when it ran; the manager never shows health it has not just checked. */
  health?: { ok: boolean; at: number }
}

/** The record of every instance this app created. Only these are ever started, stopped or removed by it. */
export function createRegistry(root: string) {
  const file = path.join(root, "instances.json")

  const list = async () =>
    readFile(file, "utf8")
      .then((text) => JSON.parse(text) as Instance[])
      .catch(() => [] as Instance[])

  const save = async (instances: readonly Instance[]) => {
    await mkdir(root, { recursive: true })
    await writeFile(file, JSON.stringify(instances, null, 2))
  }

  return {
    list,
    async add(instance: Instance) {
      const all = await list()
      if (all.some((entry) => entry.name === instance.name)) throw new Error(`An instance named ${instance.name} already exists`)
      await save([...all, instance])
    },
    async update(name: string, change: Partial<Instance>) {
      await save((await list()).map((entry) => (entry.name === name ? { ...entry, ...change } : entry)))
    },
    async remove(name: string) {
      await save((await list()).filter((entry) => entry.name !== name))
    },
    /** A name that collides with no recorded instance, container or VM this app made. */
    async uniqueName(base: string) {
      const names = new Set((await list()).map((entry) => entry.name))
      const clean = base.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "material-opencode"
      return names.has(clean) ? Array.from({ length: 99 }, (_, index) => `${clean}-${index + 2}`).find((name) => !names.has(name))! : clean
    },
  }
}

export type Registry = ReturnType<typeof createRegistry>
