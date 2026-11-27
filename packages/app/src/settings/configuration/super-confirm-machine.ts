// Two-key super confirmation: both keys must be turned before the slider unlocks, and only a slider dragged to the
// end authorizes the action. Pure transition below; the component only renders it.

export type SuperConfirmState = {
  readonly first: boolean
  readonly second: boolean
  readonly slider: number
  readonly authorized: boolean
}

export type SuperConfirmEvent =
  | { type: "key"; key: "first" | "second" }
  | { type: "slide"; value: number }
  | { type: "reset" }

export const initialSuperConfirm: SuperConfirmState = { first: false, second: false, slider: 0, authorized: false }

export function superConfirmTransition(state: SuperConfirmState, event: SuperConfirmEvent): SuperConfirmState {
  if (event.type === "reset") return initialSuperConfirm

  if (state.authorized) return state

  if (event.type === "key") {
    // Turning a key back off also drops the slider, so the order of operations can never be skipped.
    const next = { ...state, [event.key]: !state[event.key] }

    return next.first && next.second ? next : { ...next, slider: 0 }
  }

  if (!state.first || !state.second) return state
  const slider = Math.max(0, Math.min(100, event.value))

  return { ...state, slider, authorized: slider >= 100 }
}
