import { describe, expect, test } from "bun:test"
import { initialSuperConfirm, superConfirmTransition, type SuperConfirmEvent } from "./super-confirm-machine"

const run = (events: SuperConfirmEvent[]) => events.reduce(superConfirmTransition, initialSuperConfirm)

describe("super confirmation", () => {
  test("the slider stays locked until both keys are turned", () => {
    expect(run([{ type: "slide", value: 100 }]).authorized).toBe(false)
    expect(run([{ type: "key", key: "first" }, { type: "slide", value: 100 }]).authorized).toBe(false)
  })

  test("both keys and a full slide authorize; a partial slide does not", () => {
    const keys: SuperConfirmEvent[] = [{ type: "key", key: "first" }, { type: "key", key: "second" }]
    expect(run([...keys, { type: "slide", value: 60 }])).toMatchObject({ slider: 60, authorized: false })
    expect(run([...keys, { type: "slide", value: 100 }]).authorized).toBe(true)
  })

  test("turning a key back drops the slider, and reset clears everything", () => {
    const partial = run([{ type: "key", key: "first" }, { type: "key", key: "second" }, { type: "slide", value: 80 }, { type: "key", key: "second" }])
    expect(partial).toMatchObject({ second: false, slider: 0, authorized: false })
    expect(run([{ type: "key", key: "first" }, { type: "reset" }])).toEqual(initialSuperConfirm)
  })
})
