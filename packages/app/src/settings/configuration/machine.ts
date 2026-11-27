// Lifecycle of the Configuration studio: loading the global document, editing a draft, reviewing the server's
// dry-run result, and writing it. Pure: the driver in configuration.tsx turns effects into requests.

import { Predicate, Schema } from "effect"

export type ConfigPath = readonly (string | number)[]

/** `undefined` removes the key the path names. */
export type ConfigValue = Schema.Json | undefined

export type ConfigDocument = Schema.JsonObject

export type ConfigEdit = { path: ConfigPath; value: ConfigValue }

export type ConfigReview = { path: string; before: string; after: string; issues: readonly string[] }

export type ConfigStudioState =
  | { type: "loading"; attempt: number }
  | { type: "failed"; attempt: number; message: string }
  | { type: "editing"; attempt: number; document: ConfigDocument; path: string; edits: readonly ConfigEdit[] }
  | {
      type: "reviewing"
      attempt: number
      document: ConfigDocument
      path: string
      edits: readonly ConfigEdit[]
      review?: ConfigReview
    }
  | {
      type: "saving"
      attempt: number
      document: ConfigDocument
      path: string
      edits: readonly ConfigEdit[]
      review: ConfigReview
    }
  | { type: "saved"; attempt: number; document: ConfigDocument; path: string; edits: readonly ConfigEdit[] }

export type ConfigStudioEvent =
  | { type: "loaded"; attempt: number; document: ConfigDocument; path: string }
  | { type: "load.failed"; attempt: number; message: string }
  | { type: "retry" }
  | { type: "set"; path: ConfigPath; value: ConfigValue }
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

export type ConfigStudioStep = { state: ConfigStudioState; effects: readonly ConfigStudioEffect[] }

export function transition(state: ConfigStudioState, event: ConfigStudioEvent): ConfigStudioStep {
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
function upsert(edits: readonly ConfigEdit[], path: ConfigPath, value: ConfigValue) {
  return [...edits.filter((edit) => !isPrefix(path, edit.path)), { path, value }]
}

function isPrefix(prefix: ConfigPath, path: ConfigPath) {
  return prefix.length <= path.length && prefix.every((part, index) => part === path[index])
}

export function applyEdits(document: ConfigDocument, edits: readonly ConfigEdit[]) {
  return edits.reduce((current, edit) => asDocument(setIn(current, edit.path, edit.value)), document)
}

export function getIn(value: ConfigValue, path: ConfigPath): ConfigValue {
  return path.reduce<ConfigValue>((current, key) => {
    if (Array.isArray(current) && Predicate.isNumber(key)) return current[key]

    if (isDocument(current) && Predicate.isString(key)) return current[key]

    return undefined
  }, value)
}

export function isDocument(value: ConfigValue): value is ConfigDocument {
  return Predicate.isObject(value) && !Array.isArray(value)
}

function asDocument(value: ConfigValue) {
  return isDocument(value) ? value : {}
}

function setIn(value: ConfigValue, path: ConfigPath, next: ConfigValue): ConfigValue {
  if (path.length === 0) return next
  const head = path[0]
  const rest = path.slice(1)

  if (Predicate.isNumber(head)) {
    const list = Array.isArray(value) ? [...value] : []

    if (rest.length === 0 && next === undefined) return list.filter((_, index) => index !== head)
    list[head] = setIn(list[head], rest, next) ?? null

    return list
  }

  const record = isDocument(value) ? value : {}

  if (rest.length === 0 && next === undefined) return Object.fromEntries(Object.entries(record).filter(([key]) => key !== head))
  const child = setIn(record[head], rest, next)

  return child === undefined ? record : { ...record, [head]: child }
}
