import { existsSync } from "node:fs"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { applianceAssets, bundledSource, fetchAsset, imageName, sha256, type Release } from "./artifacts"
import type { Instance, Registry, TargetKind } from "./instances"
import { freePort, lanAddress, probe, run, strongPassword, waitHealthy, type Log } from "./system"

export type Step = "prepare" | "image" | "create" | "start" | "health" | "link"

export type DeployRequest = {
  target: TargetKind
  name: string
  port?: number
  sshHost?: string
  memoryMb?: number
  cpus?: number
  /** Build the web app image from the source bundled in this app instead of pulling the published one. */
  fromSource?: boolean
}

export type Context = {
  registry: Registry
  dataRoot: string
  resources: string
  release: Release | undefined
  log: Log
  step: (step: Step) => void
  progress: (fraction: number) => void
}

const vboxManage =
  process.platform === "win32" ? path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Oracle", "VirtualBox", "VBoxManage.exe") : "VBoxManage"
const vmrun =
  process.platform === "win32"
    ? path.join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "VMware", "VMware Workstation", "vmrun.exe")
    : "vmrun"

/** What each target needs on this computer, checked live. */
export async function readiness() {
  const [docker, compose, ssh, virtualbox, vmware] = await Promise.all([
    probe("docker", ["--version"]),
    probe("docker", ["compose", "version"]),
    probe("ssh", ["-V"]),
    probe(vboxManage, ["--version"]),
    probe(vmrun, []),
  ])
  return {
    docker: docker && compose ? docker : undefined,
    ssh: ssh ?? (process.platform === "win32" ? undefined : "installed"),
    virtualbox,
    vmware,
    usb: process.platform === "win32" || process.platform === "linux" ? "ready" : undefined,
    pi: process.platform === "win32" || process.platform === "linux" ? "ready" : undefined,
  }
}

export async function deploy(request: DeployRequest, ctx: Context): Promise<Instance> {
  ctx.step("prepare")
  const instances = await ctx.registry.list()
  const name = await ctx.registry.uniqueName(request.name)
  const port = request.port ?? (await freePort(4096, instances.map((entry) => entry.port)))
  const folder = path.join(ctx.dataRoot, "instances", name)
  await mkdir(folder, { recursive: true })
  const version = ctx.release?.tag ?? "bundled-source"
  const deployed = await targets[request.target]({ ...request, name, port }, folder, ctx)
  ctx.step("health")
  await waitHealthy(deployed.url, ctx.log)
  ctx.step("link")
  const instance: Instance = {
    name,
    target: request.target,
    version,
    port,
    url: deployed.url,
    folder,
    sshHost: request.sshHost,
    created: Date.now(),
    health: { ok: true, at: Date.now() },
  }
  await ctx.registry.add(instance)
  return instance
}

type Deployed = { url: string }
type Target = (request: DeployRequest & { name: string; port: number }, folder: string, ctx: Context) => Promise<Deployed>

const targets: Record<TargetKind, Target> = {
  async docker(request, folder, ctx) {
    const image = await webAppImage(request, ctx)
    await writeCompose(folder, request.name, request.port, image)
    ctx.step("start")
    await run("docker", ["compose", "--env-file", ".env", "-p", request.name, "up", "-d"], ctx.log, { cwd: folder })
    return { url: `http://${lanAddress() ?? "localhost"}:${request.port}` }
  },

  async ssh(request, folder, ctx) {
    if (!request.sshHost) throw new Error("Enter the SSH host, for example me@192.168.1.20")
    const image = `${imageName}:${ctx.release?.tag ?? "latest"}`
    await writeCompose(folder, request.name, request.port, image)
    ctx.step("create")
    const remote = `material-opencode-${request.name}`
    await run("ssh", [request.sshHost, `mkdir -p ~/${remote}`], ctx.log)
    await run("scp", ["-q", path.join(folder, "compose.yaml"), path.join(folder, ".env"), `${request.sshHost}:~/${remote}/`], ctx.log)
    ctx.step("start")
    await run("ssh", [request.sshHost, `cd ~/${remote} && docker compose --env-file .env -p ${request.name} up -d`], ctx.log)
    return { url: `http://${request.sshHost.split("@").pop()}:${request.port}` }
  },

  async virtualbox(request, folder, ctx) {
    ctx.step("image")
    const image = await applianceImage("virtualbox", ctx)
    ctx.step("create")
    const disk = path.join(folder, "disk.vdi")
    await run(vboxManage, ["clonemedium", "disk", image, disk, "--format", "VDI"], ctx.log)
    await run(vboxManage, ["createvm", "--name", request.name, "--ostype", "Linux_64", "--register", "--basefolder", folder], ctx.log)
    await run(
      vboxManage,
      [
        "modifyvm", request.name,
        "--memory", String(request.memoryMb ?? 2048),
        "--cpus", String(request.cpus ?? 2),
        "--firmware", "efi",
        "--graphicscontroller", "vmsvga",
        "--nic1", "nat",
        // Forwarding on every host address is what makes the app reachable from other devices on the network.
        "--natpf1", `app,tcp,,${request.port},,4096`,
      ],
      ctx.log,
    )
    await run(vboxManage, ["storagectl", request.name, "--name", "SATA", "--add", "sata"], ctx.log)
    await run(vboxManage, ["storageattach", request.name, "--storagectl", "SATA", "--port", "0", "--type", "hdd", "--medium", disk], ctx.log)
    ctx.step("start")
    await run(vboxManage, ["startvm", request.name, "--type", "headless"], ctx.log)
    return { url: `http://${lanAddress() ?? "localhost"}:${request.port}` }
  },

  async vmware(request, folder, ctx) {
    ctx.step("image")
    const image = await applianceImage("vmware", ctx)
    ctx.step("create")
    const vmx = path.join(folder, `${request.name}.vmx`)
    const serial = path.join(folder, "console.log")
    await writeFile(
      vmx,
      [
        `.encoding = "UTF-8"`,
        `config.version = "8"`,
        `virtualHW.version = "19"`,
        `displayName = "${request.name}"`,
        `guestOS = "other5xlinux-64"`,
        `firmware = "efi"`,
        `memsize = "${request.memoryMb ?? 2048}"`,
        `numvcpus = "${request.cpus ?? 2}"`,
        `sata0.present = "TRUE"`,
        `sata0:0.present = "TRUE"`,
        `sata0:0.fileName = "${image}"`,
        `ethernet0.present = "TRUE"`,
        `ethernet0.virtualDev = "vmxnet3"`,
        `ethernet0.connectionType = "bridged"`,
        `ethernet0.addressType = "generated"`,
        // The appliance prints its address on the serial console; the app reads it back from this file.
        `serial0.present = "TRUE"`,
        `serial0.fileType = "file"`,
        `serial0.fileName = "${serial}"`,
        "",
      ].join("\n"),
    )
    ctx.step("start")
    await run(vmrun, ["-T", "ws", "start", vmx, "nogui"], ctx.log)
    const address = await consoleAddress(serial, ctx.log)
    return { url: `http://${address}:4096` }
  },
}

async function webAppImage(request: DeployRequest, ctx: Context) {
  ctx.step("image")
  const published = `${imageName}:${ctx.release?.tag ?? "latest"}`
  if (!request.fromSource) {
    const pulled = await run("docker", ["pull", published], ctx.log).then(() => true).catch(() => false)
    if (pulled) return published
    ctx.log("The published image could not be pulled; building it from the source inside this app instead")
  }
  const source = await bundledSource(ctx.resources)
  if (!source) throw new Error("This build of the app carries no source bundle, and the published image is unavailable")
  const actual = await sha256(source.archive)
  if (actual !== source.sha256) throw new Error("The bundled source failed its checksum")
  const folder = path.join(ctx.dataRoot, "source", source.commit)
  if (!existsSync(path.join(folder, "hosting", "Dockerfile"))) {
    await mkdir(folder, { recursive: true })
    await run("tar", ["-xzf", source.archive, "-C", folder], ctx.log)
  }
  const tag = `material-opencode:${source.commit.slice(0, 12)}`
  await run("docker", ["build", "-f", path.join(folder, "hosting", "Dockerfile"), "-t", tag, folder], ctx.log)
  return tag
}

async function applianceImage(kind: keyof typeof applianceAssets, ctx: Context) {
  if (!ctx.release) throw new Error("No release is selected, so there is no appliance image to use")
  return fetchAsset(ctx.release, applianceAssets[kind], path.join(ctx.dataRoot, "cache"), ctx.log, ctx.progress)
}

async function writeCompose(folder: string, name: string, port: number, image: string) {
  const env = path.join(folder, ".env")
  const existing = existsSync(env) ? await readFile(env, "utf8") : ""
  const password = existing.match(/^OPENCODE_PASSWORD=(.+)$/m)?.[1] ?? strongPassword()
  await writeFile(
    env,
    [`OPENCODE_INSTANCE=${name}`, `OPENCODE_PORT=${port}`, "OPENCODE_BIND=0.0.0.0", `OPENCODE_WORKSPACE=./workspace`, `OPENCODE_IMAGE=${image}`, `OPENCODE_PASSWORD=${password}`, ""].join("\n"),
    { mode: 0o600 },
  )
  await mkdir(path.join(folder, "workspace"), { recursive: true })
  await writeFile(path.join(folder, "compose.yaml"), compose)
}

async function consoleAddress(file: string, log: Log) {
  const deadline = Date.now() + 600_000
  while (Date.now() < deadline) {
    const text = existsSync(file) ? await readFile(file, "utf8") : ""
    const address = text.match(/material-opencode-url: http:\/\/([0-9.]+):4096/)?.[1]
    if (address) {
      log(`The appliance reported ${address}`)
      return address
    }
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
  throw new Error("The appliance did not report its network address within 10 minutes")
}

/** Lifecycle actions for an instance this app created. */
export async function act(instance: Instance, action: "start" | "stop" | "restart" | "logs" | "remove", log: Log) {
  const compose = (args: string[]) =>
    instance.target === "ssh" && instance.sshHost
      ? run("ssh", [instance.sshHost, `cd ~/material-opencode-${instance.name} && docker compose --env-file .env -p ${instance.name} ${args.join(" ")}`], log)
      : run("docker", ["compose", "--env-file", ".env", "-p", instance.name, ...args], log, { cwd: instance.folder })
  const vm = {
    start: () =>
      instance.target === "virtualbox"
        ? run(vboxManage, ["startvm", instance.name, "--type", "headless"], log)
        : run(vmrun, ["-T", "ws", "start", path.join(instance.folder, `${instance.name}.vmx`), "nogui"], log),
    stop: () =>
      instance.target === "virtualbox"
        ? run(vboxManage, ["controlvm", instance.name, "acpipowerbutton"], log)
        : run(vmrun, ["-T", "ws", "stop", path.join(instance.folder, `${instance.name}.vmx`), "soft"], log),
  }
  const container = instance.target === "docker" || instance.target === "ssh"
  if (action === "start") return container ? compose(["up", "-d"]) : vm.start()
  if (action === "stop") return container ? compose(["stop"]) : vm.stop()
  if (action === "restart") return container ? compose(["restart"]) : vm.stop().then(() => vm.start())
  if (action === "logs")
    return container
      ? compose(["logs", "--tail", "200"])
      : readFile(path.join(instance.folder, "console.log"), "utf8").catch(() => "This virtual machine keeps no log the app can read")
  if (container) await compose(["down", "--volumes"])
  if (instance.target === "virtualbox") await run(vboxManage, ["unregistervm", instance.name, "--delete"], log).catch(() => undefined)
  if (instance.target === "vmware") await run(vmrun, ["-T", "ws", "deleteVM", path.join(instance.folder, `${instance.name}.vmx`)], log).catch(() => undefined)
  await rm(instance.folder, { recursive: true, force: true })
  return "removed"
}

const compose = `name: material-opencode
services:
  opencode:
    image: \${OPENCODE_IMAGE}
    container_name: \${OPENCODE_INSTANCE}
    restart: unless-stopped
    environment:
      OPENCODE_PASSWORD: \${OPENCODE_PASSWORD}
    ports:
      - "\${OPENCODE_BIND}:\${OPENCODE_PORT}:4096"
    volumes:
      - data:/data
      - \${OPENCODE_WORKSPACE}:/workspace
volumes:
  data: {}
`
