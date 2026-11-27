import QRCode from "qrcode"
import type { Disk } from "../core/disks"
import type { Instance, TargetKind } from "../core/instances"
import type { DeployRequest, Step } from "../core/targets"

type Readiness = Record<"docker" | "ssh" | "virtualbox" | "vmware" | "usb" | "pi", string | undefined>
type Release = { tag: string; name: string }
type Info = { version: string; platform: string; source: { commit: string; sha256: string; built: string } | undefined }
type DeployEvent = { type: "log"; line: string } | { type: "step"; step: string } | { type: "progress"; fraction: number }

type Bridge = {
  info: () => Promise<Info>
  readiness: () => Promise<Readiness>
  latestRelease: () => Promise<Release>
  run: (request: DeployRequest) => Promise<Instance>
  instances: () => Promise<Instance[]>
  checkInstances: () => Promise<Instance[]>
  act: (name: string, action: "start" | "stop" | "restart" | "logs" | "remove") => Promise<string>
  disks: () => Promise<Disk[]>
  flash: (disk: Disk, kind: "usb" | "pi") => Promise<string>
  open: (url: string) => Promise<void>
  copy: (text: string) => Promise<void>
  window: (action: "minimize" | "maximize" | "close") => Promise<void>
  onEvent: (listener: (event: DeployEvent) => void) => () => void
}

declare global {
  interface Window {
    deploy: Bridge
  }
}

const api = window.deploy
const view = document.getElementById("view") as HTMLElement
const dialogRoot = document.getElementById("dialog-root") as HTMLElement
let readiness: Readiness | undefined

type Card = { kind: TargetKind | "usb" | "pi"; title: string; body: string; missing: string }
const cards: Card[] = [
  { kind: "docker", title: "This computer", body: "Runs the web app in Docker here and gives you a link every device on your network can open.", missing: "Docker Desktop is not installed" },
  { kind: "ssh", title: "Another machine", body: "Copies the app to a Linux machine you can reach over SSH and starts it there.", missing: "The SSH client is not installed" },
  { kind: "virtualbox", title: "VirtualBox", body: "Creates a virtual machine from the appliance image, bridged so your network can reach it.", missing: "VirtualBox is not installed" },
  { kind: "vmware", title: "VMware", body: "Creates a VMware Workstation machine from the appliance image.", missing: "VMware Workstation is not installed" },
  { kind: "usb", title: "USB drive", body: "Writes the appliance to a USB drive so any PC can boot straight into it.", missing: "Not supported on this system" },
  { kind: "pi", title: "Raspberry Pi", body: "Writes the Raspberry Pi 4 image to an SD card.", missing: "Not supported on this system" },
]

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]) {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  node.append(...children)
  return node
}

function button(label: string, onClick: () => void, variant = "") {
  const node = el("button", { class: `btn ${variant}`.trim(), type: "button" }, label)
  node.addEventListener("click", onClick)
  return node
}

function closeDialog() {
  dialogRoot.replaceChildren()
}

function dialog(title: string, ...children: Node[]) {
  const box = el("div", { class: "dialog", role: "dialog", "aria-modal": "true", "aria-label": title }, el("h2", {}, title), ...children)
  const scrim = el("div", { class: "scrim" }, box)
  scrim.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDialog()
  })
  dialogRoot.replaceChildren(scrim)
  box.querySelector<HTMLElement>("input, select, button")?.focus()
  return box
}

// ---------- Deploy ----------

async function showDeploy() {
  view.replaceChildren(el("h1", {}, "Deploy"), el("p", { class: "sub" }, "Pick where Material OpenCode should run. Each target is checked on this computer right now."))
  readiness ??= await api.readiness()
  const grid = el("div", { class: "grid" })
  cards.forEach((card, index) => {
    const ready = readiness?.[card.kind]
    const node = el(
      "section",
      { class: "card", style: `animation-delay:${index * 50}ms` },
      el("h2", {}, card.title),
      el("p", {}, card.body),
      el("span", { class: ready ? "chip" : "chip missing" }, ready ? `Ready · ${ready.slice(0, 40)}` : card.missing),
    )
    const action = button("Deploy", () => (card.kind === "usb" || card.kind === "pi" ? showFlash(card.kind) : showNewInstance(card.kind)))
    action.disabled = !ready
    node.append(action)
    grid.append(node)
  })
  view.append(grid)
}

function showNewInstance(target: TargetKind) {
  const name = el("input", { value: "opencode", maxlength: "40", "aria-describedby": "name-hint" })
  const port = el("input", { value: "4096", inputmode: "numeric" })
  const sshHost = el("input", { placeholder: "user@host" })
  const memory = el("input", { type: "range", min: "1024", max: "8192", step: "512", value: "2048" })
  const cpus = el("input", { type: "range", min: "1", max: "8", value: "2" })
  const fromSource = el("input", { type: "checkbox" })
  const hint = el("span", { class: "hint", id: "name-hint" }, "Letters, numbers and dashes.")
  const fields: Node[] = [field("Name", name), hint]
  if (target === "docker" || target === "ssh") fields.push(field("Port", port))
  if (target === "ssh") fields.push(field("SSH host", sshHost))
  if (target === "virtualbox" || target === "vmware") fields.push(field("Memory (MB)", memory), field("Processors", cpus))
  if (target === "docker") fields.push(el("label", { class: "row" }, fromSource, "Build from the source inside this app instead of pulling the published image"))

  const start = button("Deploy", () => {
    const request: DeployRequest = {
      target,
      name: name.value.trim(),
      port: Number(port.value),
      sshHost: sshHost.value.trim() || undefined,
      memoryMb: Number(memory.value),
      cpus: Number(cpus.value),
      fromSource: fromSource.checked,
    }
    closeDialog()
    void runDeploy(request)
  })
  const validate = () => {
    const nameOk = /^[a-z0-9][a-z0-9-]{0,39}$/i.test(name.value.trim())
    const portValue = Number(port.value)
    const portOk = Number.isInteger(portValue) && portValue >= 1024 && portValue <= 65535
    const sshOk = target !== "ssh" || /^[^\s@]+@[^\s@]+$/.test(sshHost.value.trim())
    name.setAttribute("aria-invalid", String(!nameOk))
    port.setAttribute("aria-invalid", String(!portOk))
    sshHost.setAttribute("aria-invalid", String(!sshOk))
    hint.className = nameOk ? "hint" : "hint bad"
    start.disabled = !(nameOk && portOk && sshOk)
  }
  for (const input of [name, port, sshHost]) input.addEventListener("input", validate)
  validate()
  dialog(`New instance · ${cards.find((card) => card.kind === target)?.title}`, ...fields, el("div", { class: "row" }, button("Cancel", closeDialog, "text"), start))
}

function field(label: string, input: HTMLElement) {
  const output = input.getAttribute("type") === "range" ? el("output", {}, (input as HTMLInputElement).value) : undefined
  if (output) input.addEventListener("input", () => (output.textContent = (input as HTMLInputElement).value))
  return el("label", { class: "field" }, el("span", {}, label), input, ...(output ? [output] : []))
}

const stepLabels: Record<string, string> = {
  prepare: "Check this computer",
  image: "Get the image",
  create: "Create the instance",
  start: "Start it",
  health: "Wait for health",
  link: "Verify the link",
  writing: "Write the disk",
  verifying: "Read back and verify",
}

function runner(order: string[]) {
  const steps = el("div", { class: "steps" })
  const rows = new Map(order.map((step) => [step, el("div", { class: "step" }, el("span", { class: "dot" }), stepLabels[step] ?? step)]))
  steps.append(...rows.values())
  const bar = el("i")
  const log = el("pre", { class: "log", "aria-live": "polite" })
  let current = ""
  const stop = api.onEvent((event) => {
    if (event.type === "log") {
      log.textContent += `${event.line}\n`
      log.scrollTop = log.scrollHeight
    }
    if (event.type === "progress") bar.style.width = `${Math.round(event.fraction * 100)}%`
    if (event.type === "step") {
      rows.get(current)?.classList.replace("active", "done")
      current = event.step
      rows.get(current)?.classList.add("active")
      bar.style.width = "0"
    }
  })
  const finish = () => {
    rows.get(current)?.classList.replace("active", "done")
    stop()
  }
  const fail = () => stop()
  return { nodes: [steps, el("div", { class: "bar" }, bar), log], finish, fail, failedStep: () => stepLabels[current] ?? current }
}

async function runDeploy(request: DeployRequest) {
  selectView("deploy", false)
  const order: Step[] = ["prepare", "image", "create", "start", "health", "link"]
  const run = runner(order)
  view.replaceChildren(el("h1", {}, `Deploying ${request.name}`), el("p", { class: "sub" }, "Every step is checked; the link is shown only after it answers."), ...run.nodes)
  try {
    const instance = await api.run(request)
    run.finish()
    const qr = el("img", { alt: `QR code for ${instance.url}`, src: await QRCode.toDataURL(instance.url, { margin: 1, width: 240 }) })
    const link = el("a", { href: instance.url }, instance.url)
    link.addEventListener("click", (event) => {
      event.preventDefault()
      void api.open(instance.url)
    })
    view.insertBefore(
      el("div", { class: "result" }, qr, el("div", {}, el("p", {}, "Verified and running. Open it on any device on your network:"), link, el("div", { class: "row" }, button("Open", () => api.open(instance.url)), button("Copy link", () => api.copy(instance.url), "tonal")))),
      view.children[2] ?? null,
    )
  } catch (error) {
    run.fail()
    view.insertBefore(
      el("div", { class: "result failed", role: "alert" }, el("div", {}, el("strong", {}, `Stopped at “${run.failedStep()}”`), el("p", {}, String(error instanceof Error ? error.message : error)), el("div", { class: "row" }, button("Retry", () => runDeploy(request)), button("Back to targets", () => selectView("deploy"), "text")))),
      view.children[2] ?? null,
    )
  }
}

// ---------- Flash with two-key super confirmation ----------

function formatSize(bytes: number) {
  return `${(bytes / 1e9).toFixed(1)} GB`
}

async function showFlash(kind: "usb" | "pi") {
  const list = el("div", { class: "steps" })
  const next = button("Continue", () => chosen && confirmFlash(kind, chosen))
  next.disabled = true
  let chosen: Disk | undefined
  const refresh = async () => {
    list.replaceChildren(el("span", { class: "hint" }, "Looking for removable drives…"))
    const disks = await api.disks()
    chosen = undefined
    next.disabled = true
    if (disks.length === 0) return list.replaceChildren(el("p", { class: "hint" }, "No removable drive found. Plug in a USB drive or SD card, then refresh. Fixed and system disks are never listed."))
    list.replaceChildren(
      ...disks.map((disk) => {
        const node = el("button", { class: "disk", type: "button", "aria-pressed": "false" }, el("strong", {}, disk.name), el("span", { class: "hint" }, `${formatSize(disk.size)} · ${disk.bus} · ${disk.id}`))
        node.addEventListener("click", () => {
          list.querySelectorAll(".disk").forEach((other) => other.setAttribute("aria-pressed", "false"))
          node.setAttribute("aria-pressed", "true")
          chosen = disk
          next.disabled = false
        })
        return node
      }),
    )
  }
  dialog(kind === "pi" ? "Write the Raspberry Pi image" : "Write the appliance to a USB drive", el("p", { class: "hint" }, "Nothing is selected for you. Pick the drive to erase."), list, el("div", { class: "row" }, button("Refresh", refresh, "text"), button("Cancel", closeDialog, "text"), next))
  await refresh()
}

function confirmFlash(kind: "usb" | "pi", disk: Disk) {
  const pressed = { first: false, second: false }
  const keyA = el("button", { class: "key", type: "button", "aria-pressed": "false" }, "Key one: I understand")
  const keyB = el("button", { class: "key", type: "button", "aria-pressed": "false" }, "Key two: erase this drive")
  const slider = el("input", { type: "range", min: "0", max: "100", value: "0", "aria-label": "Slide to arm", disabled: "" })
  const erase = button(`Erase ${disk.name}`, () => {
    closeDialog()
    void runFlash(kind, disk)
  }, "danger")
  erase.disabled = true
  const update = () => {
    keyA.setAttribute("aria-pressed", String(pressed.first))
    keyB.setAttribute("aria-pressed", String(pressed.second))
    slider.disabled = !(pressed.first && pressed.second)
    if (slider.disabled) slider.value = "0"
    erase.disabled = slider.disabled || Number(slider.value) < 100
  }
  keyA.addEventListener("click", () => ((pressed.first = !pressed.first), update()))
  keyB.addEventListener("click", () => ((pressed.second = !pressed.second), update()))
  slider.addEventListener("input", update)
  dialog(
    "Erase this drive?",
    el("p", {}, `Everything on `, el("strong", {}, `${disk.name} (${formatSize(disk.size)}, ${disk.id})`), ` will be replaced. This cannot be undone.`),
    el("p", { class: "hint" }, "Turn both keys, then slide all the way to arm."),
    el("div", { class: "keys" }, keyA, keyB),
    slider,
    el("div", { class: "row" }, button("Stop — keep my drive", closeDialog, "tonal"), erase),
  )
}

async function runFlash(kind: "usb" | "pi", disk: Disk) {
  const run = runner(["image", "writing", "verifying"])
  view.replaceChildren(el("h1", {}, `Writing ${disk.name}`), el("p", { class: "sub" }, "Your system asks for permission before the write. The drive is read back and checked afterwards."), ...run.nodes)
  try {
    await api.flash(disk, kind)
    run.finish()
    view.insertBefore(el("div", { class: "result" }, el("div", {}, el("strong", {}, "Written and verified"), el("p", {}, kind === "pi" ? "Put the card in the Pi and power it on. The address is printed on its screen and shown by your router." : "Boot a PC from this drive. The address is printed on its screen once the app is up."))), view.children[2] ?? null)
  } catch (error) {
    run.fail()
    view.insertBefore(el("div", { class: "result failed", role: "alert" }, el("div", {}, el("strong", {}, `Stopped at “${run.failedStep()}”`), el("p", {}, String(error instanceof Error ? error.message : error)))), view.children[2] ?? null)
  }
}

// ---------- Instances ----------

async function showInstances(check = false) {
  view.replaceChildren(el("h1", {}, "Instances"), el("p", { class: "sub" }, "Only instances this app created are listed; health is checked when you ask."))
  const instances = check ? await api.checkInstances() : await api.instances()
  const toolbar = el("div", { class: "row" }, button("Check health", () => showInstances(true), "tonal"), button("New", () => selectView("deploy"), "text"))
  if (instances.length === 0) return view.append(toolbar, el("div", { class: "empty" }, "Nothing deployed yet. Pick a target on the Deploy page."))
  const body = el("tbody")
  for (const instance of instances) {
    const health = instance.health ? (instance.health.ok ? "ok" : "bad") : ""
    const actions = el("td", {}, el("div", { class: "row" },
      button("Open", () => api.open(instance.url), "text"),
      button("Copy", () => api.copy(instance.url), "text"),
      button("Restart", () => act(instance, "restart"), "text"),
      button("Stop", () => act(instance, "stop"), "text"),
      button("Start", () => act(instance, "start"), "text"),
      button("Logs", () => act(instance, "logs"), "text"),
      button("Remove", () => removeInstance(instance), "text"),
    ))
    body.append(el("tr", {},
      el("td", {}, el("strong", {}, instance.name)),
      el("td", {}, instance.target),
      el("td", {}, instance.version),
      el("td", {}, el("span", { class: `health ${health}` }), health === "ok" ? "Healthy" : health === "bad" ? "Not answering" : "Not checked"),
      el("td", {}, instance.url),
      actions,
    ))
  }
  view.append(toolbar, el("table", {}, el("thead", {}, el("tr", {}, ...["Name", "Target", "Version", "Health", "Link", ""].map((label) => el("th", {}, label)))), body))
}

async function act(instance: Instance, action: "start" | "stop" | "restart" | "logs") {
  const output = await api.act(instance.name, action).catch((error: Error) => error.message)
  if (action === "logs") dialog(`Logs · ${instance.name}`, el("pre", { class: "log" }, output), button("Close", closeDialog))
  else await showInstances(true)
}

function removeInstance(instance: Instance) {
  dialog(
    `Remove ${instance.name}?`,
    el("p", {}, `This stops and deletes the ${instance.target} instance “${instance.name}”. Your projects folder ${instance.folder} is kept.`),
    el("div", { class: "row" }, button("Keep it", closeDialog, "tonal"), button("Remove", async () => {
      closeDialog()
      await api.act(instance.name, "remove")
      await showInstances()
    }, "danger")),
  )
}

// ---------- Images and help ----------

async function showImages() {
  const info = await api.info()
  view.replaceChildren(
    el("h1", {}, "Images"),
    el("p", { class: "sub" }, "What this app carries and what it downloads."),
    el("section", { class: "card" }, el("h2", {}, "Source inside this app"), el("p", {}, info.source ? `Commit ${info.source.commit.slice(0, 12)} · built ${info.source.built} · SHA-256 ${info.source.sha256.slice(0, 16)}…` : "No source bundle in this build."), el("span", { class: "chip" }, `App ${info.version} · ${info.platform}`)),
    el("section", { class: "card" }, el("h2", {}, "Appliance images"), el("p", {}, "Downloaded from the latest release when a target needs one, checked against SHA256SUMS, and kept in the cache.")),
  )
}

function showHelp() {
  view.replaceChildren(
    el("h1", {}, "Help"),
    el("section", { class: "card" }, el("h2", {}, "How it works"), el("p", {}, "Pick a target, answer a few questions, and the app does the rest: it gets the image, creates the instance, waits until it answers, and only then shows the link.")),
    el("section", { class: "card" }, el("h2", {}, "Safety"), el("p", {}, "Drive writing lists removable drives only, never preselects one, needs two keys and a slide naming the drive, and reads the drive back afterwards.")),
  )
}

// ---------- Shell ----------

const views: Record<string, () => unknown> = { deploy: showDeploy, instances: () => showInstances(), images: showImages, help: showHelp }

function selectView(name: string, render = true) {
  document.querySelectorAll<HTMLButtonElement>(".rail button").forEach((node) => {
    if (node.dataset.view === name) node.setAttribute("aria-current", "page")
    else node.removeAttribute("aria-current")
  })
  if (render) void views[name]?.()
}

document.querySelectorAll<HTMLButtonElement>(".rail button").forEach((node) => node.addEventListener("click", () => selectView(node.dataset.view ?? "deploy")))
document.querySelectorAll<HTMLButtonElement>("[data-window]").forEach((node) =>
  node.addEventListener("click", () => api.window(node.dataset.window as "minimize" | "maximize" | "close")),
)

api
  .latestRelease()
  .then((release) => (document.getElementById("release-chip")!.textContent = `Latest release ${release.tag}`))
  .catch(() => (document.getElementById("release-chip")!.textContent = "Offline · the source inside this app still works"))

selectView("deploy")
