import { Config } from "@opencode/core/config"
import { ShellSelect } from "@opencode/core/shell/select"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../api"

export const ConfigHandler = HttpApiBuilder.group(Api, "server.config", (handlers) =>
  handlers
    .handle("config.get", () => Config.Service.use((config) => config.entries()))
    .handle(
      "config.update",
      Effect.fn(function* (ctx) {
        const config = yield* Config.Service
        if (!config.update) return yield* Effect.die(new Error("Config updates are unavailable"))
        return yield* config.update(ctx.payload).pipe(Effect.orDie)
      }),
    )
    .handle(
      "config.edit",
      Effect.fn(function* (ctx) {
        const config = yield* Config.Service
        if (!config.edit) return yield* Effect.die(new Error("Config edits are unavailable"))
        return yield* config.edit(ctx.payload).pipe(Effect.orDie)
      }),
    )
    .handle(
      "config.shells",
      Effect.fn(function* () {
        const shell = yield* ShellSelect.Service
        if (!shell.list) return yield* Effect.die(new Error("Shell discovery is unavailable"))
        return yield* shell.list()
      }),
    ),
)
