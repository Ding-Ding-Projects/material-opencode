import { createMemo, createSignal, For, Match, onCleanup, Show, Switch as Branch, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { diffLines } from "diff"
import { parse, type ParseError } from "jsonc-parser"
import { Button } from "@opencode/ui/button"
import { Icon } from "@opencode/ui/icon"
import { Loader } from "@opencode/ui/loader"
import { Textarea } from "@opencode/ui/textarea"
import { TextInput } from "@opencode/ui/text-input"
import { useLanguage } from "@/runtime/i18n/language"
import { useServerSDK } from "@/runtime/server/client"
import { ConfigField, type FieldContext } from "./fields"
import {
  createConfigStudioState,
  draft,
  pendingCount,
  samePath,
  transition,
  type ConfigEdit,
  type ConfigStudioEffect,
  type ConfigStudioEvent,
} from "./machine"
import { categoryKeys, configCategories, createConfigSchema, type ConfigCategory } from "./schema-tree"
import "./configuration.css"

/**
 * Every key of opencode.json as a rich control. Edits collect into a draft, the server validates them in a dry run
 * and shows the exact JSONC change, and only then writes the global config document.
 */
export function SettingsConfiguration(props: { headerAction?: JSX.Element }) {
  const language = useLanguage()
  const sdk = useServerSDK()
  const schema = createConfigSchema()
  const [studio, setStudio] = createSignal(createConfigStudioState())
  const [view, setView] = createStore<{ category: ConfigCategory; query: string; regex: boolean; raw: string | undefined }>({
    category: "general",
    query: "",
    regex: false,
    raw: undefined,
  })
  const [sources, setSources] = createStore<Record<string, ("global" | "project")[]>>({})
  let disposed = false
  onCleanup(() => (disposed = true))

  const dispatch = (event: ConfigStudioEvent) => {
    if (disposed) return
    const result = transition(studio(), event)
    if (result.state !== studio()) setStudio(result.state)
    result.effects.forEach(run)
  }

  const run = (effect: ConfigStudioEffect) => {
    if (effect.type === "load") return void load(effect.attempt)
    if (effect.type === "dry-run")
      return void sdk.api.experimental.config
        .edit({ edits: wire(effect.edits), dryRun: true })
        .then((result) => dispatch({ type: "reviewed", attempt: effect.attempt, review: result }))
        .catch((error: unknown) => dispatch({ type: "review.failed", attempt: effect.attempt, message: message(error) }))
    void sdk.api.experimental.config
      .edit({ edits: wire(effect.edits) })
      .then((result) =>
        result.written || result.issues.length === 0
          ? dispatch({ type: "saved", attempt: effect.attempt })
          : dispatch({ type: "save.failed", attempt: effect.attempt, message: result.issues.join("\n") }),
      )
      .catch((error: unknown) => dispatch({ type: "save.failed", attempt: effect.attempt, message: message(error) }))
  }

  const load = async (attempt: number) => {
    const [document, entries] = await Promise.all([
      sdk.api.experimental.config.edit({ edits: [], dryRun: true }),
      sdk.api.config.get().catch(() => []),
    ]).catch((error: unknown) => {
      dispatch({ type: "load.failed", attempt, message: message(error) })
      return [undefined, []] as const
    })
    if (!document) return
    const boundary = entries.findIndex((entry) => entry.type === "directory")
    const layers = entries.flatMap((entry, index) =>
      entry.type === "document" && entry.path !== document.path
        ? Object.keys(entry.info).map((key) => [key, boundary === -1 || index < boundary ? "global" : "project"] as const)
        : [],
    )
    setSources(
      layers.reduce<Record<string, ("global" | "project")[]>>((all, [key, layer]) => {
        const list = all[key] ?? []
        return { ...all, [key]: list.includes(layer) ? list : [...list, layer] }
      }, {}),
    )
    const parsed: unknown = parse(document.before, [], { allowTrailingComma: true })
    dispatch({
      type: "loaded",
      attempt,
      path: document.path,
      document: parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {},
    })
  }

  // The initial state is already `loading` with attempt 0, so the first request runs under that attempt.
  void load(0)

  const value = createMemo(() => draft(studio()))
  const edits = () => {
    const state = studio()
    return state.type === "loading" || state.type === "failed" ? [] : state.edits
  }

  const ctx: FieldContext = {
    resolve: schema.resolve,
    set: (path, next) => dispatch({ type: "set", path, value: next }),
    sources: (key) => sources[key] ?? [],
    pending: (path) => edits().some((edit) => samePath(edit.path, path)),
  }

  const matcher = createMemo(() => {
    const query = view.query.trim()
    if (!query) return undefined
    if (!view.regex) return (text: string) => text.toLowerCase().includes(query.toLowerCase())
    const pattern = compile(query)
    return pattern ? (text: string) => pattern.test(text) : () => false
  })

  const keys = createMemo(() => {
    const match = matcher()
    const all = Object.keys(schema.root.properties ?? {})
    if (match) return all.filter((key) => match(key) || match(schema.root.properties?.[key]?.description ?? ""))
    return categoryKeys(schema.root, view.category)
  })

  const categories = createMemo(() => {
    const extra = categoryKeys(schema.root, "other").length > 0 ? (["other"] as const) : []
    return [...configCategories.map((item) => item.id), ...extra, "raw" as const]
  })

  return (
    <div data-component="config-studio" data-motion="expressive">
      <div class="settings-tab-header">
        <div class="settings-tab-header-row">
          <div class="flex flex-col gap-1">
            <h2 class="settings-tab-title">{language.t("settings.configuration.title")}</h2>
            <span class="text-11-regular text-v2-text-text-muted">{language.t("settings.configuration.description")}</span>
          </div>
          {props.headerAction}
        </div>
      </div>

      <Branch>
        <Match when={studio().type === "loading"}>
          <div data-slot="config-stage" data-stage="loading">
            <Loader />
            <span>{language.t("settings.configuration.loading")}</span>
          </div>
        </Match>
        <Match when={studio().type === "failed"}>
          <div data-slot="config-stage" data-stage="error" role="alert">
            <Icon name="circle-exclamation" />
            <div>
              <strong>{language.t("settings.configuration.loadFailed")}</strong>
              <p>{(studio() as { message: string }).message}</p>
            </div>
            <Button size="small" variant="outline" icon="refresh" onClick={() => dispatch({ type: "retry" })}>
              {language.t("common.retry")}
            </Button>
          </div>
        </Match>
        <Match when={true}>
          <div data-slot="config-layout">
            <nav data-slot="config-rail" aria-label={language.t("settings.configuration.categories")}>
              <For each={categories()}>
                {(category) => (
                  <button
                    type="button"
                    data-slot="config-rail-item"
                    aria-current={!matcher() && view.category === category ? "page" : undefined}
                    onClick={() => setView({ category, query: "" })}
                  >
                    <span>{language.t(`settings.configuration.category.${category}`)}</span>
                    <Show when={categoryKeys(schema.root, category).some((key) => value()[key] !== undefined)}>
                      <span data-slot="config-rail-dot" aria-hidden="true" />
                    </Show>
                  </button>
                )}
              </For>
            </nav>

            <section data-slot="config-main">
              <div data-slot="config-toolbar">
                <TextInput
                  appearance="small"
                  leadingIcon={<Icon name="magnifying-glass" />}
                  aria-label={language.t("settings.configuration.search")}
                  placeholder={language.t("settings.configuration.search")}
                  value={view.query}
                  invalid={view.regex && view.query !== "" && !compile(view.query)}
                  onInput={(event) => setView("query", event.currentTarget.value)}
                />
                <button
                  type="button"
                  data-slot="config-regex"
                  aria-pressed={view.regex}
                  aria-label={language.t("settings.configuration.regex")}
                  title={language.t("settings.configuration.regex")}
                  onClick={() => setView("regex", (current) => !current)}
                >
                  .*
                </button>
                <span data-slot="config-path" title={(studio() as { path?: string }).path}>
                  <Icon name="file-document" size="small" />
                  <code>{(studio() as { path?: string }).path}</code>
                </span>
              </div>

              <Show
                when={!matcher() && view.category === "raw"}
                fallback={
                  <div data-slot="config-fields">
                    <For each={keys()} fallback={<p data-slot="config-empty">{language.t("settings.configuration.noMatches")}</p>}>
                      {(key) => (
                        <ConfigField
                          name={key}
                          path={[key]}
                          schema={schema.root.properties?.[key] ?? {}}
                          value={value()[key]}
                          ctx={ctx}
                          depth={0}
                        />
                      )}
                    </For>
                  </div>
                }
              >
                <RawEditor
                  value={value()}
                  text={view.raw}
                  onText={(text) => setView("raw", text)}
                  onApply={(next) => {
                    const current = value()
                    const changed = [...new Set([...Object.keys(current), ...Object.keys(next)])].filter(
                      (key) => JSON.stringify(current[key]) !== JSON.stringify(next[key]),
                    )
                    changed.forEach((key) => dispatch({ type: "set", path: [key], value: next[key] }))
                    setView("raw", undefined)
                  }}
                />
              </Show>
            </section>
          </div>

          <Show when={pendingCount(studio()) > 0 || studio().type === "saved"}>
            <div data-slot="config-savebar" data-state={studio().type} role="status">
              <Show
                when={studio().type !== "saved"}
                fallback={
                  <>
                    <Icon name="circle-check" />
                    <span>{language.t("settings.configuration.saved")}</span>
                  </>
                }
              >
                <span data-slot="config-savebar-count">
                  {language.plural("settings.configuration.pendingCount", pendingCount(studio()))}
                </span>
                <Button size="small" variant="ghost" onClick={() => dispatch({ type: "discard" })}>
                  {language.t("settings.configuration.discard")}
                </Button>
                <Button size="small" variant="submit" onClick={() => dispatch({ type: "review" })}>
                  {language.t("settings.configuration.review")}
                </Button>
              </Show>
            </div>
          </Show>

          <Show when={studio().type === "reviewing" || studio().type === "saving" ? studio() : undefined}>
            {(state) => (
              <ReviewDrawer
                state={state() as ReviewState}
                onCancel={() => dispatch({ type: "cancel" })}
                onSave={() => dispatch({ type: "save" })}
              />
            )}
          </Show>
        </Match>
      </Branch>
    </div>
  )
}

type ReviewState = {
  type: "reviewing" | "saving"
  edits: readonly ConfigEdit[]
  review?: { path: string; before: string; after: string; issues: readonly string[] }
}

function ReviewDrawer(props: { state: ReviewState; onCancel: () => void; onSave: () => void }) {
  const language = useLanguage()
  const changes = createMemo(() => (props.state.review ? diffLines(props.state.review.before, props.state.review.after) : []))
  const issues = () => props.state.review?.issues ?? []
  return (
    <div data-slot="config-review" role="dialog" aria-modal="true" aria-label={language.t("settings.configuration.reviewTitle")} data-floating-overlay>
      <div data-slot="config-review-panel">
        <header>
          <h3>{language.t("settings.configuration.reviewTitle")}</h3>
          <code>{props.state.review?.path}</code>
        </header>
        <Show when={props.state.review} fallback={<div data-slot="config-stage" data-stage="loading"><Loader /></div>}>
          <Show when={issues().length > 0}>
            <div data-slot="config-issues" role="alert">
              <Icon name="outline-hexagonal-warning" />
              <div>
                <strong>{language.t("settings.configuration.invalid")}</strong>
                <For each={issues()}>{(issue) => <pre>{issue}</pre>}</For>
              </div>
            </div>
          </Show>
          <pre data-slot="config-diff">
            <For each={changes()}>
              {(part) => (
                <span data-change={part.added ? "added" : part.removed ? "removed" : "same"}>{part.value}</span>
              )}
            </For>
          </pre>
        </Show>
        <footer>
          <Button size="small" variant="ghost" onClick={props.onCancel} disabled={props.state.type === "saving"}>
            {language.t("settings.configuration.keepEditing")}
          </Button>
          <Button
            size="small"
            variant={props.state.type === "saving" ? "loading" : "submit"}
            disabled={!props.state.review || issues().length > 0 || props.state.type === "saving"}
            onClick={props.onSave}
          >
            {language.t("settings.configuration.save")}
          </Button>
        </footer>
      </div>
    </div>
  )
}

function RawEditor(props: {
  value: Record<string, unknown>
  text: string | undefined
  onText: (text: string) => void
  onApply: (value: Record<string, unknown>) => void
}) {
  const language = useLanguage()
  const text = () => props.text ?? JSON.stringify(props.value, null, 2)
  const parsed = createMemo(() => {
    const errors: ParseError[] = []
    const result: unknown = parse(text(), errors, { allowTrailingComma: true })
    if (errors.length || !result || typeof result !== "object" || Array.isArray(result)) return undefined
    return result as Record<string, unknown>
  })
  return (
    <div data-slot="config-raw">
      <p>{language.t("settings.configuration.rawDescription")}</p>
      <Textarea
        aria-label={language.t("settings.configuration.category.raw")}
        invalid={!parsed()}
        value={text()}
        spellcheck={false}
        onInput={(event) => props.onText(event.currentTarget.value)}
      />
      <Button size="small" variant="outline" disabled={!parsed() || props.text === undefined} onClick={() => parsed() && props.onApply(parsed()!)}>
        {language.t("settings.configuration.applyRaw")}
      </Button>
    </div>
  )
}

function wire(edits: readonly ConfigEdit[]) {
  return edits.map((edit) => ({ path: [...edit.path], value: edit.value as never }))
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function compile(pattern: string) {
  // A half-typed regular expression is normal while searching, so an invalid one matches nothing instead of throwing.
  try {
    return new RegExp(pattern, "i")
  } catch {
    return undefined
  }
}
