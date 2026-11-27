import { app, BrowserWindow, clipboard, ipcMain, shell } from "electron"
import path from "node:path"
import { applianceAssets, bundledSource, fetchAsset, latestRelease, type Release } from "./core/artifacts"
import { flash, removableDisks, type Disk } from "./core/disks"
import { createRegistry } from "./core/instances"
import { act, deploy, readiness, type DeployRequest } from "./core/targets"

// Everything the app creates lives under its own data folder, so it never touches files it did not make.
const dataRoot = path.join(app.getPath("userData"), "deployments")
const registry = createRegistry(dataRoot)
const resources = app.isPackaged ? process.resourcesPath : path.join(__dirname, "..", "resources")
let release: Release | undefined

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: "#fef7ff",
    title: "Material OpenCode Deploy",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true },
  })
  window.loadFile(path.join(__dirname, "renderer", "index.html"))
  return window
}

app.whenReady().then(() => {
  const window = createWindow()
  const send = (channel: string, payload: object) => window.webContents.send(channel, payload)
  const log = (line: string) => send("deploy:event", { type: "log", line })

  ipcMain.handle("app:info", async () => ({
    version: app.getVersion(),
    platform: process.platform,
    source: await bundledSource(resources),
  }))
  ipcMain.handle("app:readiness", () => readiness())
  ipcMain.handle("release:latest", async () => {
    release = await latestRelease()
    return release
  })
  ipcMain.handle("deploy:run", (_event, request: DeployRequest) =>
    deploy(request, {
      registry,
      dataRoot,
      resources,
      release,
      log,
      step: (step) => send("deploy:event", { type: "step", step }),
      progress: (fraction) => send("deploy:event", { type: "progress", fraction }),
    }),
  )
  ipcMain.handle("instances:list", () => registry.list())
  ipcMain.handle("instances:check", async () => {
    const instances = await registry.list()
    await Promise.all(
      instances.map(async (instance) => {
        const ok = await fetch(instance.url, { signal: AbortSignal.timeout(5000) })
          .then((response) => response.status < 500)
          .catch(() => false)
        await registry.update(instance.name, { health: { ok, at: Date.now() } })
      }),
    )
    return registry.list()
  })
  ipcMain.handle("instances:act", async (_event, name: string, action: "start" | "stop" | "restart" | "logs" | "remove") => {
    const instance = (await registry.list()).find((entry) => entry.name === name)
    if (!instance) throw new Error(`${name} is not an instance this app created`)
    const output = await act(instance, action, log)
    if (action === "remove") await registry.remove(name)
    return output
  })
  ipcMain.handle("disks:list", () => removableDisks(log))
  ipcMain.handle("disks:flash", async (_event, disk: Disk, kind: "usb" | "pi") => {
    if (!release) release = await latestRelease()
    send("deploy:event", { type: "step", step: "image" })
    const image = await fetchAsset(release, applianceAssets[kind], path.join(dataRoot, "cache"), log, (fraction) =>
      send("deploy:event", { type: "progress", fraction }),
    )
    await flash(image, disk, log, (phase) => send("deploy:event", { type: "step", step: phase }))
    return "verified"
  })
  ipcMain.handle("shell:open", (_event, url: string) => (/^https?:\/\//.test(url) ? shell.openExternal(url) : undefined))
  ipcMain.handle("clipboard:write", (_event, text: string) => clipboard.writeText(text))
  ipcMain.handle("window:control", (_event, action: "minimize" | "maximize" | "close") => {
    if (action === "minimize") return window.minimize()
    if (action === "close") return window.close()
    return window.isMaximized() ? window.unmaximize() : window.maximize()
  })
})

app.on("window-all-closed", () => app.quit())
