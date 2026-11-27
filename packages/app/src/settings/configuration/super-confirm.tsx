import { createSignal, Show } from "solid-js"
import { Icon } from "@opencode/ui/icon"
import { useLanguage } from "@/runtime/i18n/language"

import { initialSuperConfirm, superConfirmTransition, type SuperConfirmEvent } from "./super-confirm-machine"

export function SuperConfirm(props: { action: string; detail: string; onAuthorized: (authorized: boolean) => void; onCancel: () => void }) {
  const language = useLanguage()
  const [state, setState] = createSignal(initialSuperConfirm)
  const dispatch = (event: SuperConfirmEvent) => {
    const next = superConfirmTransition(state(), event)
    if (next === state()) return
    setState(next)
    props.onAuthorized(next.authorized)
  }
  const unlocked = () => state().first && state().second

  return (
    <div
      data-component="super-confirm"
      data-authorized={state().authorized}
      data-unlocked={unlocked()}
      role="group"
      aria-label={language.t("superConfirm.label", { action: props.action })}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return
        event.stopPropagation()
        dispatch({ type: "reset" })
        props.onCancel()
      }}
    >
      <div data-slot="super-confirm-copy">
        <Icon name="outline-hexagonal-warning" />
        <div>
          <strong>{props.action}</strong>
          <p>{props.detail}</p>
        </div>
      </div>
      <div data-slot="super-confirm-keys">
        <button type="button" data-slot="super-confirm-key" aria-pressed={state().first} onClick={() => dispatch({ type: "key", key: "first" })}>
          <Icon name="lock" />
          <span>{language.t(state().first ? "superConfirm.keyOneTurned" : "superConfirm.keyOne")}</span>
        </button>
        <button type="button" data-slot="super-confirm-key" aria-pressed={state().second} onClick={() => dispatch({ type: "key", key: "second" })}>
          <Icon name="lock" />
          <span>{language.t(state().second ? "superConfirm.keyTwoTurned" : "superConfirm.keyTwo")}</span>
        </button>
      </div>
      <label data-slot="super-confirm-slider" style={{ "--progress": `${state().slider}%` }}>
        <span>{language.t(unlocked() ? "superConfirm.slide" : "superConfirm.slideLocked")}</span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          disabled={!unlocked() || state().authorized}
          value={state().slider}
          aria-valuetext={`${state().slider}%`}
          onInput={(event) => dispatch({ type: "slide", value: Number(event.currentTarget.value) })}
        />
      </label>
      <Show when={state().authorized}>
        <p data-slot="super-confirm-done" role="status">
          <Icon name="circle-check" />
          {language.t("superConfirm.authorized")}
        </p>
      </Show>
      <button
        type="button"
        data-slot="super-confirm-exit"
        onClick={() => {
          dispatch({ type: "reset" })
          props.onCancel()
        }}
      >
        {language.t("superConfirm.emergencyExit")}
      </button>
    </div>
  )
}
