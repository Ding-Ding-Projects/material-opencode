import { createMemo, createSignal, For, Index, Match, Show, Switch as SolidSwitch } from "solid-js"
import { Switch } from "@opencode/ui/switch"
import { Select } from "@opencode/ui/select"
import { SegmentedControl, SegmentedControlItem } from "@opencode/ui/segmented-control"
import { TextInput } from "@opencode/ui/text-input"
import { Textarea } from "@opencode/ui/textarea"
import { Button } from "@opencode/ui/button"
import { IconButton } from "@opencode/ui/icon-button"
import { Icon } from "@opencode/ui/icon"
import { Tooltip } from "@opencode/ui/tooltip"
import { useLanguage } from "@/runtime/i18n/language"
import type { ConfigPath } from "./machine"
import {
  defaultFor,
  enumOptions,
  kindOf,
  matchVariant,
  sliderRange,
  variantLabel,
  variants,
  type JsonSchema,
} from "./schema-tree"

export type FieldContext = {
  resolve: (schema: JsonSchema) => JsonSchema
  set: (path: ConfigPath, value: unknown) => void
  /** Which layers besides this document set a top-level key, for the source badge. */
  sources: (key: string) => readonly ("global" | "project")[]
  pending: (path: ConfigPath) => boolean
}

type FieldProps = {
  name: string
  path: ConfigPath
  schema: JsonSchema
  value: unknown
  ctx: FieldContext
  depth: number
  /** Removes this entry from its parent list or record instead of resetting the key. */
  onRemove?: () => void
}

/** One configuration value with the richest control its schema allows, its description and its reset. */
export function ConfigField(props: FieldProps) {
  const language = useLanguage()
  const schema = createMemo(() => props.ctx.resolve(props.schema))
  const kind = createMemo(() => kindOf(schema(), props.ctx.resolve))
  const isSet = () => props.value !== undefined
  const nested = () => kind() === "object" || kind() === "record" || kind() === "list" || kind() === "union"
  const [open, setOpen] = createSignal(props.depth < 1)

  const header = (
    <div data-slot="config-field-header">
      <Show when={nested()}>
        <IconButton
          variant="ghost"
          size="small"
          aria-expanded={open()}
          aria-label={language.t(open() ? "settings.configuration.collapse" : "settings.configuration.expand")}
          icon={<Icon name={open() ? "chevron-down" : "chevron-right"} />}
          onClick={() => setOpen((value) => !value)}
        />
      </Show>
      <code data-slot="config-field-name">{props.name}</code>
      <Show when={schema().description}>
        {(description) => (
          <Tooltip value={description()} appearance="large">
            <span data-slot="config-field-info" aria-label={description()} tabIndex={0}>
              <Icon name="info" size="small" />
            </span>
          </Tooltip>
        )}
      </Show>
      <Show when={props.depth === 0}>
        <For each={props.ctx.sources(String(props.path[0]))}>
          {(source) => (
            <span data-slot="config-source" data-source={source}>
              {language.t(source === "global" ? "settings.configuration.source.global" : "settings.configuration.source.project")}
            </span>
          )}
        </For>
        <Show when={!isSet() && props.ctx.sources(String(props.path[0])).length === 0}>
          <span data-slot="config-source" data-source="default">
            {language.t("settings.configuration.source.default")}
          </span>
        </Show>
      </Show>
      <Show when={props.ctx.pending(props.path)}>
        <span data-slot="config-pending" aria-label={language.t("settings.configuration.pending")} />
      </Show>
      <span data-slot="config-field-spacer" />
      <Show when={!nested()}>
        <div data-slot="config-field-control">
          <Scalar {...props} kind={kind()} schema={schema()} />
        </div>
      </Show>
      <Show when={props.onRemove}>
        {(remove) => (
          <IconButton
            variant="ghost-muted"
            size="small"
            aria-label={language.t("settings.configuration.remove")}
            icon={<Icon name="trash" />}
            onClick={() => remove()()}
          />
        )}
      </Show>
      <Show when={!props.onRemove && isSet()}>
        <IconButton
          variant="ghost-muted"
          size="small"
          aria-label={language.t("settings.configuration.reset")}
          icon={<Icon name="reset" />}
          onClick={() => props.ctx.set(props.path, undefined)}
        />
      </Show>
    </div>
  )

  return (
    <div data-component="config-field" data-kind={kind()} data-depth={props.depth} data-set={isSet()}>
      {header}
      <Show when={props.depth === 0 && schema().description}>
        <p data-slot="config-field-description">{schema().description}</p>
      </Show>
      <Show when={nested() && open()}>
        <div data-slot="config-field-body">
          <SolidSwitch>
            <Match when={kind() === "object"}>
              <ObjectFields {...props} schema={schema()} />
            </Match>
            <Match when={kind() === "record"}>
              <RecordFields {...props} schema={schema()} />
            </Match>
            <Match when={kind() === "list"}>
              <ListFields {...props} schema={schema()} />
            </Match>
            <Match when={kind() === "union"}>
              <UnionField {...props} schema={schema()} />
            </Match>
          </SolidSwitch>
        </div>
      </Show>
    </div>
  )
}

function Scalar(props: FieldProps & { kind: string }) {
  const language = useLanguage()
  return (
    <SolidSwitch fallback={<JsonEditor {...props} />}>
      <Match when={props.kind === "boolean"}>
        <Switch checked={props.value === true} onChange={(checked) => props.ctx.set(props.path, checked)} hideLabel>
          {props.name}
        </Switch>
      </Match>
      <Match when={props.kind === "enum"}>
        <EnumControl {...props} />
      </Match>
      <Match when={props.kind === "string"}>
        <TextInput
          appearance="small"
          aria-label={props.name}
          value={typeof props.value === "string" ? props.value : ""}
          placeholder={language.t("settings.configuration.unset")}
          invalid={typeof props.value === "string" && !!props.schema.pattern && !new RegExp(props.schema.pattern).test(props.value)}
          onChange={(event) => props.ctx.set(props.path, event.currentTarget.value === "" ? undefined : event.currentTarget.value)}
        />
      </Match>
      <Match when={props.kind === "number"}>
        <NumberControl {...props} />
      </Match>
      <Match when={props.kind === "strings"}>
        <ChipsControl {...props} />
      </Match>
    </SolidSwitch>
  )
}

function EnumControl(props: FieldProps) {
  const options = createMemo(() => enumOptions(props.schema, props.ctx.resolve))
  const current = () => (typeof props.value === "string" ? props.value : undefined)
  return (
    <Show
      when={options().length <= 4}
      fallback={
        <Select
          appearance="small"
          options={options()}
          current={current()}
          onSelect={(value) => value !== null && props.ctx.set(props.path, value)}
        />
      }
    >
      <SegmentedControl value={current() ?? null} onChange={(value) => value && props.ctx.set(props.path, value)}>
        <For each={options()}>{(option) => <SegmentedControlItem value={option}>{option}</SegmentedControlItem>}</For>
      </SegmentedControl>
    </Show>
  )
}

function NumberControl(props: FieldProps) {
  const range = () => sliderRange(props.schema)
  const value = () => (typeof props.value === "number" ? props.value : undefined)
  const commit = (text: string) => {
    if (text === "") return props.ctx.set(props.path, undefined)
    const next = Number(text)
    if (Number.isFinite(next)) props.ctx.set(props.path, props.schema.type === "integer" ? Math.round(next) : next)
  }
  return (
    <div data-slot="config-number">
      <Show when={range()}>
        {(bounds) => (
          <input
            type="range"
            aria-label={props.name}
            min={bounds().min}
            max={bounds().max}
            step={bounds().step}
            value={value() ?? bounds().min}
            onInput={(event) => commit(event.currentTarget.value)}
          />
        )}
      </Show>
      <TextInput
        appearance="small"
        numeric
        type="number"
        aria-label={props.name}
        value={value() === undefined ? "" : String(value())}
        min={props.schema.minimum}
        max={props.schema.maximum}
        onChange={(event) => commit(event.currentTarget.value)}
      />
    </div>
  )
}

function ChipsControl(props: FieldProps) {
  const language = useLanguage()
  const items = () => (Array.isArray(props.value) ? props.value.filter((item): item is string => typeof item === "string") : [])
  const add = (input: HTMLInputElement) => {
    const text = input.value.trim()
    if (!text) return
    props.ctx.set(props.path, [...items(), text])
    input.value = ""
  }
  return (
    <div data-slot="config-chips">
      <Index each={items()}>
        {(item, index) => (
          <span data-slot="config-chip">
            <span>{item()}</span>
            <button
              type="button"
              aria-label={language.t("settings.configuration.removeItem", { item: item() })}
              onClick={() => props.ctx.set(props.path, items().filter((_, position) => position !== index))}
            >
              <Icon name="close-small" />
            </button>
          </span>
        )}
      </Index>
      <input
        data-slot="config-chip-input"
        aria-label={language.t("settings.configuration.addItem", { name: props.name })}
        placeholder={language.t("settings.configuration.addItemPlaceholder")}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return
          event.preventDefault()
          add(event.currentTarget)
        }}
        onBlur={(event) => add(event.currentTarget)}
      />
    </div>
  )
}

function ObjectFields(props: FieldProps) {
  const record = () => (props.value && typeof props.value === "object" && !Array.isArray(props.value) ? (props.value as Record<string, unknown>) : {})
  return (
    <div data-slot="config-group">
      <For each={Object.entries(props.schema.properties ?? {})}>
        {([key, child]) => (
          <ConfigField name={key} path={[...props.path, key]} schema={child} value={record()[key]} ctx={props.ctx} depth={props.depth + 1} />
        )}
      </For>
    </div>
  )
}

function RecordFields(props: FieldProps) {
  const language = useLanguage()
  const record = () => (props.value && typeof props.value === "object" && !Array.isArray(props.value) ? (props.value as Record<string, unknown>) : {})
  const item = () => (typeof props.schema.additionalProperties === "object" ? props.schema.additionalProperties : {})
  const add = (input: HTMLInputElement) => {
    const key = input.value.trim()
    if (!key || key in record()) return
    props.ctx.set([...props.path, key], defaultFor(props.ctx.resolve(item()), props.ctx.resolve))
    input.value = ""
  }
  return (
    <div data-slot="config-group">
      <For each={Object.keys(record())}>
        {(key) => (
          <div data-slot="config-card">
            <ConfigField
              name={key}
              path={[...props.path, key]}
              schema={item()}
              value={record()[key]}
              ctx={props.ctx}
              depth={props.depth + 1}
              onRemove={() => props.ctx.set([...props.path, key], undefined)}
            />
          </div>
        )}
      </For>
      <Show when={Object.keys(record()).length === 0}>
        <p data-slot="config-empty">{language.t("settings.configuration.emptyRecord")}</p>
      </Show>
      <form
        data-slot="config-add"
        onSubmit={(event) => {
          event.preventDefault()
          const input = event.currentTarget.elements.namedItem("key")
          if (input instanceof HTMLInputElement) add(input)
        }}
      >
        <TextInput appearance="small" name="key" aria-label={language.t("settings.configuration.newKey")} placeholder={language.t("settings.configuration.newKey")} />
        <Button type="submit" size="small" variant="outline" icon="plus">
          {language.t("settings.configuration.addEntry")}
        </Button>
      </form>
    </div>
  )
}

function ListFields(props: FieldProps) {
  const language = useLanguage()
  const items = () => (Array.isArray(props.value) ? props.value : [])
  const item = () => props.schema.items ?? {}
  const move = (index: number, offset: number) => {
    const next = [...items()]
    const [entry] = next.splice(index, 1)
    next.splice(index + offset, 0, entry)
    props.ctx.set(props.path, next)
  }
  return (
    <div data-slot="config-group">
      <Index each={items()}>
        {(value, index) => (
          <div data-slot="config-card" data-ordered>
            <div data-slot="config-order">
              <span data-slot="config-ordinal">{index + 1}</span>
              <IconButton
                variant="ghost"
                size="small"
                disabled={index === 0}
                aria-label={language.t("settings.configuration.moveUp")}
                icon={<Icon name="arrow-up" />}
                onClick={() => move(index, -1)}
              />
              <IconButton
                variant="ghost"
                size="small"
                disabled={index === items().length - 1}
                aria-label={language.t("settings.configuration.moveDown")}
                icon={<Icon name="arrow-down-to-line" />}
                onClick={() => move(index, 1)}
              />
            </div>
            <ConfigField
              name={`#${index + 1}`}
              path={[...props.path, index]}
              schema={item()}
              value={value()}
              ctx={props.ctx}
              depth={props.depth + 1}
              onRemove={() => props.ctx.set(props.path, items().filter((_, position) => position !== index))}
            />
          </div>
        )}
      </Index>
      <Button
        size="small"
        variant="outline"
        icon="plus"
        onClick={() => props.ctx.set(props.path, [...items(), defaultFor(props.ctx.resolve(item()), props.ctx.resolve)])}
      >
        {language.t("settings.configuration.addItemButton")}
      </Button>
    </div>
  )
}

function UnionField(props: FieldProps) {
  const language = useLanguage()
  const options = createMemo(() => variants(props.schema).map((_, index) => index))
  const active = createMemo(() => matchVariant(props.schema, props.value, props.ctx.resolve))
  const branch = () => variants(props.schema)[active()] ?? {}
  return (
    <div data-slot="config-group">
      <div data-slot="config-variant">
        <span>{language.t("settings.configuration.variant")}</span>
        <Select
          appearance="small"
          options={options()}
          current={active()}
          label={(index) => variantLabel(props.schema, index, props.ctx.resolve)}
          onSelect={(index) => {
            if (index === null || index === active()) return
            props.ctx.set(props.path, defaultFor(props.ctx.resolve(variants(props.schema)[index] ?? {}), props.ctx.resolve))
          }}
        />
      </div>
      <ConfigField name={props.name} path={props.path} schema={branch()} value={props.value} ctx={props.ctx} depth={props.depth + 1} />
    </div>
  )
}

/** The last resort for a shape no richer control fits: JSON that applies only when it parses. */
function JsonEditor(props: FieldProps) {
  const language = useLanguage()
  const [error, setError] = createSignal(false)
  return (
    <div data-slot="config-json">
      <Textarea
        aria-label={props.name}
        invalid={error()}
        value={props.value === undefined ? "" : JSON.stringify(props.value, null, 2)}
        onChange={(event) => {
          const text = event.currentTarget.value.trim()
          if (text === "") return props.ctx.set(props.path, undefined)
          const parsed = parseJson(text)
          setError(parsed === invalid)
          if (parsed !== invalid) props.ctx.set(props.path, parsed)
        }}
      />
      <Show when={error()}>
        <span data-slot="config-json-error">{language.t("settings.configuration.invalidJson")}</span>
      </Show>
    </div>
  )
}

const invalid = Symbol("invalid")

function parseJson(text: string): unknown {
  // JSON.parse is the boundary for a hand-typed value; a syntax error is an expected outcome, not a crash.
  try {
    return JSON.parse(text)
  } catch {
    return invalid
  }
}

