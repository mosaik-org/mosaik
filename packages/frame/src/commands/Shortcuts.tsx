import { css } from "@mosaik/styled-system/css"
import { Kbd, Modal, SwitchField } from "@mosaik/ui"
import { type Accessor, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { createKeyMatcher, isCharacterBinding, keysBelongElsewhere, parseKeys, showKeys, strokeOf } from "./keys"
import type { Command } from "./types"

const LETTERS_KEY = "mosaik-letter-shortcuts"
/** How long a sequence waits for its next key. */
const SEQUENCE_MS = 1_000

const keysOf = (command: Command): ReadonlyArray<string> =>
  command.keys === undefined ? [] : typeof command.keys === "string" ? [command.keys] : command.keys

/** The key to show beside a command in the palette: its first way, as one piece of text. */
export const firstKeys = (command: Command): string | undefined => {
  const [first] = keysOf(command)
  return first === undefined ? undefined : showKeys(first).join(" ")
}

const readLetters = (): boolean => {
  try {
    return localStorage.getItem(LETTERS_KEY) !== "off"
  } catch {
    return true
  }
}

const writeLetters = (on: boolean) => {
  try {
    localStorage.setItem(LETTERS_KEY, on ? "on" : "off")
  } catch {
    // Storage may be unavailable: the choice lasts until the page is reloaded.
  }
}

export interface Shortcuts {
  /** Plain letters run commands. People can turn them off, as they get in the way of screen readers and voice control. */
  readonly letters: Accessor<boolean>
  readonly setLetters: (on: boolean) => void
}

/** Runs the commands whose keys are pressed, for as long as the calling component is mounted. */
export const createShortcuts = (commands: Accessor<ReadonlyArray<Command>>): Shortcuts => {
  const [letters, setLetters] = createSignal(readLetters())
  const bound = createMemo(() =>
    commands()
      .flatMap((command) => keysOf(command).map((keys) => ({ binding: parseKeys(keys), value: command })))
      .filter(({ binding }) => letters() || !isCharacterBinding(binding)),
  )
  const matcher = createKeyMatcher<Command>()
  let timer: ReturnType<typeof setTimeout> | undefined

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Mid-composition (an input method), or already handled by what has focus.
      if (event.isComposing || event.defaultPrevented) return
      const stroke = strokeOf(event)
      if (stroke === undefined || keysBelongElsewhere(stroke, event.target)) return
      clearTimeout(timer)
      const match = matcher.feed(stroke, bound())
      if (match._tag === "none") return
      event.preventDefault()
      if (match._tag === "wait") {
        timer = setTimeout(() => matcher.reset(), SEQUENCE_MS)
        return
      }
      if (event.repeat && match.value.repeats !== true) return
      void match.value.perform()
    }
    window.addEventListener("keydown", onKeyDown)
    onCleanup(() => {
      window.removeEventListener("keydown", onKeyDown)
      clearTimeout(timer)
    })
  })

  return {
    letters,
    setLetters: (on) => {
      writeLetters(on)
      setLetters(on)
    },
  }
}

const styles = {
  stack: css({ display: "flex", flexDirection: "column", gap: "5", width: "full" }),
  group: css({ display: "flex", flexDirection: "column", gap: "1" }),
  groupLabel: css({ fontSize: "xs", fontWeight: "medium", color: "fg.muted", mb: "1" }),
  row: css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4", minH: "7" }),
  title: css({ fontSize: "sm", color: "fg", minW: "0", truncate: true }),
  keys: css({ display: "flex", alignItems: "center", gap: "1", flexShrink: "0" }),
  or: css({ fontSize: "xs", color: "fg.muted", mx: "0.5" }),
}

const Keys = (props: { keys: string }) => <For each={showKeys(props.keys)}>{(key) => <Kbd size="sm">{key}</Kbd>}</For>

const Row = (props: { title: string; keys: ReadonlyArray<string> }) => (
  <div class={styles.row}>
    <span class={styles.title}>{props.title}</span>
    <span class={styles.keys}>
      <For each={props.keys}>
        {(keys, index) => (
          <>
            <Show when={index() > 0}>
              <span class={styles.or}>or</span>
            </Show>
            <Keys keys={keys} />
          </>
        )}
      </For>
    </span>
  </div>
)

/** Every shortcut that works right now, from the commands themselves, so it cannot go out of date. */
export const ShortcutsPanel = (props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  commands: ReadonlyArray<Command>
  shortcuts: Shortcuts
}) => {
  const groups = createMemo(() => {
    const byGroup = new Map<string, Array<Command>>()
    // What the page registered first: it is what the person is looking at.
    for (const command of props.commands.toReversed()) {
      if (keysOf(command).length === 0) continue
      byGroup.set(command.group, [...(byGroup.get(command.group) ?? []), command])
    }
    return [...byGroup]
  })

  return (
    <Modal
      open={props.open}
      onOpenChange={(details) => props.onOpenChange(details.open)}
      title="Keyboard shortcuts"
      size="sm"
    >
      <div class={styles.stack}>
        <For each={groups()}>
          {([group, commands]) => (
            <div class={styles.group}>
              <div class={styles.groupLabel}>{group}</div>
              <For each={commands}>{(command) => <Row title={command.title} keys={keysOf(command)} />}</For>
            </div>
          )}
        </For>
        <div class={styles.group}>
          <div class={styles.groupLabel}>Everywhere</div>
          <Row title="Search and commands" keys={["mod+k"]} />
        </div>
        <SwitchField
          label="Single-letter shortcuts"
          helperText="Turn these off if they get in the way of a screen reader or voice control."
          checked={props.shortcuts.letters()}
          onCheckedChange={props.shortcuts.setLetters}
        />
      </div>
    </Modal>
  )
}
