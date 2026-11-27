import { contextBridge, ipcRenderer } from "electron"

// The page gets named operations only; it never reaches Node, the file system or arbitrary IPC channels.
contextBridge.exposeInMainWorld("deploy", {
  info: () => ipcRenderer.invoke("app:info"),
  readiness: () => ipcRenderer.invoke("app:readiness"),
  latestRelease: () => ipcRenderer.invoke("release:latest"),
  run: (request: object) => ipcRenderer.invoke("deploy:run", request),
  instances: () => ipcRenderer.invoke("instances:list"),
  checkInstances: () => ipcRenderer.invoke("instances:check"),
  act: (name: string, action: string) => ipcRenderer.invoke("instances:act", name, action),
  disks: () => ipcRenderer.invoke("disks:list"),
  flash: (disk: object, kind: string) => ipcRenderer.invoke("disks:flash", disk, kind),
  open: (url: string) => ipcRenderer.invoke("shell:open", url),
  copy: (text: string) => ipcRenderer.invoke("clipboard:write", text),
  window: (action: string) => ipcRenderer.invoke("window:control", action),
  onEvent: (listener: (event: object) => void) => {
    const handler = (_event: unknown, payload: object) => listener(payload)
    ipcRenderer.on("deploy:event", handler)
    return () => ipcRenderer.removeListener("deploy:event", handler)
  },
})
