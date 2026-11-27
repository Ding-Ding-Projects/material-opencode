// Lifecycle of the Configuration studio: loading the global document, editing a draft, reviewing the server's
// dry-run result, and writing it. Pure: the driver in configuration.tsx turns effects into requests.

export type ConfigPath = readonly (string | number)[]

export type ConfigEdit = { path: ConfigPath; value: unknown }

export type ConfigReview = { path: string; before: string; after: string; issues: readonly string[] }

export type ConfigStudioState =
  | { type: "loading"; attempt: number }
  | { type: "failed"; attempt: number; message: string }
  | { type: "editing"; attempt: number; document: Record<string, unknown>; path: string; edits: readonly ConfigEdit[] }
  | {
      type: "reviewing"
      attempt: number
      document: Record<string, unknown>
      path: string
      edits: readonly ConfigEdit[]
      review?: ConfigReview
    }
  | {
      type: "saving"
      attempt: number
      document: Record<string, unknown>
      path: string
      edits: readonly ConfigEdit[]
      review: ConfigReview
    }
  | { type: "saved"; attempt: number; document: Record<string, unknown>; path: string; edits: readonly ConfigEdit[] }

export type ConfigStudioEvent =
  | { type: "loaded"; attempt: number; document: Record<string, unknown>; path: string }
  | { type: "load.failed"; attempt: number; message: string }
  | { type: "retry" }
  | { type: "set"; path: ConfigPath; value: unknown }
  | { type: "discard" }
  | { type: "review" }
  | { type: "reviewed"; attempt: number; review: ConfigReview }
  | { type: "review.failed"; attempt: number; message: string }
  | { type: "cancel" }
  | { type: "save" }
  | { type: "saved"; attempt: number }
  | { type: "save.failed"; attempt: number; message: string }
  | { type: "reload" }

export type ConfigStudioEffect =
  | { type: "load"; attempt: number }
  | { type: "dry-run"; attempt: number; edits: readonly ConfigEdit[] }
  | { type: "write"; attempt: number; edits: readonly ConfigEdit[] }

export function createConfigStudioState(): ConfigStudioState {
  return { type: "loading", attempt: 0 }
}

export function transition(
  state: ConfigStudioState,
  event: ConfigStudioEvent,
): { state: ConfigStudioState; effects: readonly ConfigStudioEffect[] } {
  const same = { state, effects: [] }
  switch (event.type) {
    case "loaded":
      if (state.type !== "loading" || state.attempt !== event.attempt) return same
      return { state: { type: "editing", attempt: state.attempt, document: event.document, path: event.path, edits: [] }, effects: [] }
    case "load.failed":
      if (state.type !== "loading" || state.attempt !== event.attempt) return same
      return { state: { type: "failed", attempt: state.attempt, message: event.message }, effects: [] }
    case "retry":
    case "reload": {
      if (state.type === "loading" || state.type === "saving" || state.type === "reviewing") return same
      if (event.type === "retry" && state.type !== "failed") return same
      const attempt = state.attempt + 1
      return { state: { type: "loading", attempt }, effects: [{ type: "load", attempt }] }
    }
    case "set": {
      if (state.type !== "editing" && state.type !== "saved") return same
      return {
        state: {
          type: "editing",
          attempt: state.attempt,
          document: state.document,
          path: state.path,
          edits: upsert(state.type === "saved" ? [] : state.edits, event.path, event.value),
        },
        effects: [],
      }
    }
    case "discard":
      if (state.type !== "editing") return same
      return { state: { ...state, edits: [] }, effects: [] }
    case "review": {
      if (state.type !== "editing" || state.edits.length === 0) return same
      const attempt = state.attempt + 1
      return {
        state: { type: "reviewing", attempt, document: state.document, path: state.path, edits: state.edits },
        effects: [{ type: "dry-run", attempt, edits: state.edits }],
      }
    }
    case "reviewed":
      if (state.type !== "reviewing" || state.attempt !== event.attempt) return same
      return { state: { ...state, review: event.review }, effects: [] }
    case "review.failed":
      if (state.type !== "reviewing" || state.attempt !== event.attempt) return same
      return {
        state: { ...state, review: { path: state.path, before: "", after: "", issues: [event.message] } },
        effects: [],
      }
    case "cancel":
      if (state.type !== "reviewing") return same
      return {
        state: { type: "editing", attempt: state.attempt, document: state.document, path: state.path, edits: state.edits },
        effects: [],
      }
    case "save": {
      if (state.type !== "reviewing" || !state.review || state.review.issues.length > 0) return same
      const attempt = state.attempt + 1
      return {
        state: { ...state, type: "saving", attempt, review: state.review },
        effects: [{ type: "write", attempt, edits: state.edits }],
      }
    }
    case "saved":
      if (state.type !== "saving" || state.attempt !== event.attempt) return same
      return {
        state: { type: "saved", attempt: state.attempt, document: applyEdits(state.document, state.edits), path: state.path, edits: [] },
        effects: [],
      }
    case "save.failed":
      if (state.type !== "saving" || state.attempt !== event.attempt) return same
      return {
        state: { type: "reviewing", attempt: state.attempt, document: state.document, path: state.path, edits: state.edits, review: { ...state.review, issues: [event.message] } },
        effects: [],
      }
  }
}

/** The document as it will read after the pending edits. */
export function draft(state: ConfigStudioState) {
  if (state.type === "loading" || state.type === "failed") return {}
  return applyEdits(state.document, state.edits)
}

export function pendingCount(state: ConfigStudioState) {
  if (state.type === "loading" || state.type === "failed") return 0
  return state.edits.length
}

export function samePath(a: ConfigPath, b: ConfigPath) {
  return a.length === b.length && a.every((part, index) => part === b[index])
}

// A later edit to a path replaces an earlier one, and drops edits nested under it, which it overwrites.
function upsert(edits: readonly ConfigEdit[], path: ConfigPath, value: unknown) {
  return [...edits.filter((edit) => !isPrefix(path, edit.path)), { path, value }]
}

function isPrefix(prefix: ConfigPath, path: ConfigPath) {
  return prefix.length <= path.length && prefix.every((part, index) => part === path[index])
}

export function applyEdits(document: Record<string, unknown>, edits: readonly ConfigEdit[]) {
  return edits.reduce<Record<string, unknown>>((current, edit) => setIn(current, edit.path, edit.value) as Record<string, unknown>, document)
}

export function getIn(value: unknown, path: ConfigPath): unknown {
  return path.reduce<unknown>((current, key) => {
    if (Array.isArray(current) && typeof key === "number") return current[key]
    if (current && typeof current === "object" && typeof key === "string") return (current as Record<string, unknown>)[key]
    return undefined
  }, value)
}

function setIn(value: unknown, path: ConfigPath, next: unknown): unknown {
  if (path.length === 0) return next
  const [head, ...rest] = path
  if (typeof head === "number") {
    const list = Array.isArray(value) ? [...value] : []
    if (rest.length === 0 && next === undefined) return list.filter((_, index) => index !== head)
    list[head] = setIn(list[head], rest, next)
    return list
  }
  const record = value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {}
  if (rest.length === 0 && next === undefined) {
    delete record[head]
    return record
  }
  record[head] = setIn(record[head], rest, next)
  return record
}
