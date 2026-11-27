import { describe, expect, test } from "bun:test"
import { createConfigStudioState, draft, transition, type ConfigStudioEvent, type ConfigStudioState } from "./machine"

function run(events: ConfigStudioEvent[], start: ConfigStudioState = createConfigStudioState()) {
  return events.reduce((state, event) => transition(state, event).state, start)
}

const loaded: ConfigStudioEvent = { type: "loaded", attempt: 0, path: "/home/me/.config/opencode/opencode.jsonc", document: { share: "manual", watcher: { ignore: ["dist"] } } }

describe("config studio machine", () => {
  test("a later edit replaces an earlier one and the edits under it", () => {
    const state = run([
      loaded,
      { type: "set", path: ["watcher", "ignore"], value: ["dist", "build"] },
      { type: "set", path: ["watcher"], value: { ignore: [] } },
      { type: "set", path: ["share"], value: "auto" },
    ])

    expect(state.type === "editing" && state.edits.map((edit) => edit.path)).toEqual([["watcher"], ["share"]])
    expect(draft(state)).toEqual({ share: "auto", watcher: { ignore: [] } })
  })

  test("removing a key drops it from the draft", () => {
    expect(draft(run([loaded, { type: "set", path: ["share"], value: undefined }]))).toEqual({ watcher: { ignore: ["dist"] } })
  })

  test("a stale dry run is ignored and invalid changes cannot be saved", () => {
    const reviewing = run([loaded, { type: "set", path: ["share"], value: "nope" }, { type: "review" }])
    expect(reviewing.type).toBe("reviewing")
    const stale = transition(reviewing, { type: "reviewed", attempt: 0, review: { path: "", before: "", after: "", issues: [] } })
    expect(stale.state).toBe(reviewing)
    const invalid = run([{ type: "reviewed", attempt: reviewing.attempt, review: { path: "p", before: "{}", after: "{}", issues: ["share: expected manual | auto | disabled"] } }, { type: "save" }], reviewing)
    expect(invalid.type).toBe("reviewing")
  })

  test("a valid review saves, folds the edits into the document and clears them", () => {
    const reviewing = run([loaded, { type: "set", path: ["share"], value: "auto" }, { type: "review" }])
    const ready = run([{ type: "reviewed", attempt: reviewing.attempt, review: { path: "p", before: "{}", after: "{}", issues: [] } }], reviewing)
    const saving = transition(ready, { type: "save" })
    expect(saving.effects).toEqual([{ type: "write", attempt: saving.state.attempt, edits: [{ path: ["share"], value: "auto" }] }])
    const saved = run([{ type: "saved", attempt: saving.state.attempt }], saving.state)
    expect(saved.type).toBe("saved")
    expect(draft(saved)).toEqual({ share: "auto", watcher: { ignore: ["dist"] } })
  })

  test("a failed write returns to review with the error", () => {
    const reviewing = run([loaded, { type: "set", path: ["share"], value: "auto" }, { type: "review" }])
    const ready = run([{ type: "reviewed", attempt: reviewing.attempt, review: { path: "p", before: "{}", after: "{}", issues: [] } }], reviewing)
    const saving = transition(ready, { type: "save" }).state
    const failed = transition(saving, { type: "save.failed", attempt: saving.attempt, message: "EACCES" }).state
    expect(failed.type === "reviewing" && failed.review?.issues).toEqual(["EACCES"])
  })

  test("a failed load retries under a new attempt", () => {
    const failed = run([{ type: "load.failed", attempt: 0, message: "offline" }])
    const retry = transition(failed, { type: "retry" })
    expect(retry.state).toEqual({ type: "loading", attempt: 1 })
    expect(retry.effects).toEqual([{ type: "load", attempt: 1 }])
  })
})
