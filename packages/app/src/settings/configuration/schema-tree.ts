import { Predicate, Schema } from "effect"
import { Config } from "@opencode/schema/config"
import { isDocument, type ConfigValue } from "./machine"

// The Configuration studio renders every key of opencode.json from the same contract the server validates against.
// It reads the encoded JSON Schema (the shape written to disk) and takes descriptions from the type side, where the
// optional fields carry their annotations, the same way `packages/schema/script/config-schema.ts` publishes them.

export type JsonSchema = {
  readonly type?: string | readonly string[]
  readonly enum?: readonly Schema.Json[]
  readonly anyOf?: readonly JsonSchema[]
  readonly oneOf?: readonly JsonSchema[]
  readonly $ref?: string
  readonly properties?: Readonly<Record<string, JsonSchema>>
  readonly additionalProperties?: boolean | JsonSchema
  readonly items?: JsonSchema
  readonly description?: string
  readonly title?: string
  readonly minimum?: number
  readonly maximum?: number
  readonly exclusiveMinimum?: number
  readonly pattern?: string
  readonly required?: readonly string[]
}

export type FieldKind =
  | "boolean"
  | "enum"
  | "string"
  | "number"
  | "strings"
  | "list"
  | "object"
  | "record"
  | "union"
  | "json"

export type ConfigSchema = ReturnType<typeof createConfigSchema>

export function createConfigSchema() {
  const encoded = Schema.toJsonSchemaDocument(Config.Info)
  const typed = Schema.toJsonSchemaDocument(Schema.toType(Config.Info))
  // SAFETY: `toJsonSchemaDocument` emits JSON Schema definitions, which `JsonSchema` describes structurally.
  const definitions = encoded.definitions as Readonly<Record<string, JsonSchema>>

  const resolve = (schema: JsonSchema): JsonSchema => {
    const seen = new Set<string>()
    let current = schema

    while (current.$ref && !seen.has(current.$ref)) {
      seen.add(current.$ref)
      const next = definitions[current.$ref.replace("#/$defs/", "")]

      if (!next) return current
      current = { ...next, description: current.description ?? next.description }
    }

    return current
  }

  // SAFETY: the document root is a JSON Schema object, as above.
  const root = resolve(encoded.schema as JsonSchema)
  // Both documents name their root `Config.InfoEncoded`, so the type side resolves against its own definitions.
  // SAFETY: the type-side document has the same JSON Schema shape as the encoded one.
  const typedSchema = typed.schema as JsonSchema
  // SAFETY: as above, for its definitions.
  const typedDefinitions = typed.definitions as Readonly<Record<string, JsonSchema>>
  const typeRef = typedSchema.$ref?.replace("#/$defs/", "")
  const typeRoot = (typeRef ? typedDefinitions[typeRef] : undefined) ?? typedSchema

  const properties = Object.fromEntries(
    Object.entries(root.properties ?? {})
      .filter(([key]) => key !== "$schema")
      .map(([key, value]) => [
        key,
        { ...value, description: typeRoot.properties?.[key]?.description ?? value.description } satisfies JsonSchema,
      ]),
  )

  return { root: { ...root, properties } satisfies JsonSchema, resolve }
}

export function variants(schema: JsonSchema) {
  return schema.anyOf ?? schema.oneOf ?? []
}

export function kindOf(schema: JsonSchema, resolve: (schema: JsonSchema) => JsonSchema): FieldKind {
  const options = variants(schema)

  if (options.length > 0) {
    const resolved = options.map(resolve)

    if (resolved.every((option) => option.enum && option.enum.every(Predicate.isString))) return "enum"

    return "union"
  }

  if (schema.enum && schema.enum.length > 1) return "enum"
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type

  if (type === "boolean") return "boolean"

  if (type === "string") return "string"

  if (type === "number" || type === "integer") return "number"

  if (type === "array") {
    const items = schema.items ? resolve(schema.items) : undefined

    if (items && kindOf(items, resolve) === "string") return "strings"

    return "list"
  }

  if (type === "object") {
    if (schema.properties && Object.keys(schema.properties).length > 0) return "object"

    if (Predicate.isObject(schema.additionalProperties)) return "record"
  }

  return "json"
}

/** String options of an enum field, flattened across `anyOf` branches. */
export function enumOptions(schema: JsonSchema, resolve: (schema: JsonSchema) => JsonSchema) {
  const options = variants(schema)
  const values = options.length > 0 ? options.map(resolve).flatMap((option) => option.enum ?? []) : (schema.enum ?? [])

  return values.filter(Predicate.isString)
}

/** The branch of a union that the current value fits, so the editor opens on it. */
export function matchVariant(schema: JsonSchema, value: ConfigValue, resolve: (schema: JsonSchema) => JsonSchema) {
  const options = variants(schema).map(resolve)
  const index = options.findIndex((option) => fits(option, value, resolve))

  return index === -1 ? 0 : index
}

function fits(schema: JsonSchema, value: ConfigValue, resolve: (schema: JsonSchema) => JsonSchema): boolean {
  if (value === undefined) return false

  if (variants(schema).length > 0) return variants(schema).some((option) => fits(resolve(option), value, resolve))

  if (schema.enum) return value !== undefined && schema.enum.includes(value)
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type

  if (type === "boolean") return Predicate.isBoolean(value)

  if (type === "string") return Predicate.isString(value)

  if (type === "number" || type === "integer") return Predicate.isNumber(value)

  if (type === "array") return Array.isArray(value)

  if (type === "object") {
    if (!isDocument(value)) return false
    const required = schema.required ?? []

    return required.every((key) => key in value)
  }

  return false
}

export function variantLabel(schema: JsonSchema, index: number, resolve: (schema: JsonSchema) => JsonSchema) {
  const option = resolve(variants(schema)[index] ?? {})

  if (option.title) return option.title

  if (variants(schema)[index]?.$ref) return variants(schema)[index]!.$ref!.replace("#/$defs/", "").replace(/Encoded$/, "")

  if (option.enum && option.enum.length === 1) return JSON.stringify(option.enum[0])
  const type = Predicate.isString(option.type) ? option.type : option.type?.join(" | ")

  if (type === "object" && option.required?.length) return `{ ${option.required.join(", ")} }`

  return type ?? "value"
}

/** A starting value for a new entry of this schema. */
export function defaultFor(schema: JsonSchema, resolve: (schema: JsonSchema) => JsonSchema): Schema.Json {
  const options = variants(schema)

  if (options.length > 0) return defaultFor(resolve(options[0]!), resolve)

  if (schema.enum && schema.enum.length > 0) return schema.enum[0]
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type

  if (type === "boolean") return false

  if (type === "string") return ""

  if (type === "number" || type === "integer") return Math.max(schema.minimum ?? 0, (schema.exclusiveMinimum ?? -1) + 1)

  if (type === "array") return []

  if (type === "object") {
    const required = schema.required ?? []

    return Object.fromEntries(
      required.map((key) => [key, defaultFor(resolve(schema.properties?.[key] ?? {}), resolve)]),
    )
  }

  return null
}

/** A slider only makes sense for a bounded range a person would drag through. */
export function sliderRange(schema: JsonSchema) {
  const min = schema.minimum ?? (schema.exclusiveMinimum !== undefined ? schema.exclusiveMinimum + 1 : undefined)
  const max = schema.maximum

  if (min === undefined || max === undefined || max - min > 100_000) return undefined

  return { min, max, step: schema.type === "integer" ? 1 : (max - min) / 100 }
}

export const configCategories = [
  { id: "general", keys: ["shell", "model", "default_agent", "username", "timezone", "update", "enterprise"] },
  { id: "models", keys: ["providers"] },
  { id: "agents", keys: ["agents", "commands"] },
  { id: "permissions", keys: ["bypass_permissions", "permissions", "policies"] },
  { id: "tools", keys: ["mcp", "tool_output", "media"] },
  { id: "code", keys: ["lsp", "formatter"] },
  { id: "files", keys: ["watcher", "worktree", "snapshots"] },
  { id: "sessions", keys: ["compaction", "warming", "share"] },
  { id: "integrations", keys: ["websearch", "references", "plugins", "skills", "instructions"] },
  { id: "automations", keys: ["automations"] },
  { id: "experimental", keys: ["experimental"] },
] as const

export type ConfigCategory = (typeof configCategories)[number]["id"] | "other" | "raw"

/** Every top-level key belongs to a category, including keys a newer schema adds that the list above predates. */
export function categoryKeys(root: JsonSchema, category: ConfigCategory) {
  const all = Object.keys(root.properties ?? {})

  if (category === "raw") return []

  if (category === "other") {
    const known = new Set<string>(configCategories.flatMap((item) => [...item.keys]))

    return all.filter((key) => !known.has(key))
  }

  const entry = configCategories.find((item) => item.id === category)

  return (entry?.keys ?? []).filter((key) => all.includes(key))
}
