import { describe, expect, test } from "bun:test"
import { categoryKeys, configCategories, createConfigSchema, kindOf } from "./schema-tree"

describe("config studio schema", () => {
  const schema = createConfigSchema()

  test("every top-level config key has a category, so none is unreachable from the studio", () => {
    const listed = new Set([...configCategories.flatMap((item) => [...item.keys]), ...categoryKeys(schema.root, "other")])
    expect(Object.keys(schema.root.properties ?? {}).filter((key) => !listed.has(key))).toEqual([])
  })

  test("values get the richest control their schema allows", () => {
    const kind = (key: string) => kindOf(schema.resolve(schema.root.properties?.[key] ?? {}), schema.resolve)
    expect(kind("update")).toBe("enum")
    expect(kind("snapshots")).toBe("boolean")
    expect(kind("skills")).toBe("strings")
    expect(kind("agents")).toBe("record")
    expect(kind("tool_output")).toBe("object")
    expect(kind("lsp")).toBe("union")
  })

  test("top-level descriptions come from the type side, where optional fields carry them", () => {
    expect(schema.root.properties?.update?.description).toContain("updates")
  })
})
