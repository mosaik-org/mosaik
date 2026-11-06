/**
 * Key bindings as data, away from the DOM: what a command's `keys` means, how to match it against
 * what is pressed, how to show it, and when the keyboard belongs to something else.
 */

/** One press: its key in lower case ("j", "?", "enter"), and the modifiers that count. */
export interface Stroke {
  readonly key: string
  readonly mod: boolean
  readonly shift: boolean
}

/** Presses in order: one for "a" or "mod+enter", two for "g i". */
export type Binding = ReadonlyArray<Stroke>

/** Parses "a", "?", "shift+j", "mod+enter" or a sequence "g i". `mod` is ⌘ on a Mac and Ctrl elsewhere. */
export const parseKeys = (keys: string): Binding =>
  keys
    .trim()
    .split(/\s+/)
    .map((stroke): Stroke => {
      const parts = stroke.toLowerCase().split("+")
      const key = parts.at(-1) ?? ""
      return { key, mod: parts.includes("mod"), shift: parts.includes("shift") }
    })

/**
 * The stroke of a key event, or nothing for a press that is only a modifier, or that holds Alt: many
 * keyboards type letters with AltGr, which must never run a command.
 */
export const strokeOf = (
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">,
): Stroke | undefined => {
  if (event.altKey || ["Control", "Meta", "Shift", "Alt", "AltGraph", "CapsLock"].includes(event.key)) return undefined
  const key = event.key.toLowerCase()
  // Shift already chose a symbol ("?" is shift and "/" on some layouts, not on others): the symbol is the key.
  const shiftCounts = key.length > 1 || /^[a-z]$/.test(key)
  return { key, mod: event.ctrlKey || event.metaKey, shift: event.shiftKey && shiftCounts }
}

const sameStroke = (a: Stroke, b: Stroke) => a.key === b.key && a.mod === b.mod && a.shift === b.shift

/** A plain character without a modifier: what screen readers and voice control use as well. */
export const isCharacterBinding = (binding: Binding): boolean => {
  const first = binding[0]
  return first !== undefined && !first.mod && first.key.length === 1
}

export interface Bound<T> {
  readonly binding: Binding
  readonly value: T
}

/** What a press means: run this, wait for the next press of a sequence, or nothing. */
export type KeyMatch<T> =
  | { readonly _tag: "run"; readonly value: T }
  | { readonly _tag: "wait" }
  | { readonly _tag: "none" }

/**
 * Follows presses against bindings, remembering the start of a sequence. Later bindings win, so what a
 * page registers replaces what its layout did for as long as the page is open.
 */
export const createKeyMatcher = <T>() => {
  let pending: ReadonlyArray<Stroke> = []

  const matches = (bound: ReadonlyArray<Bound<T>>, strokes: ReadonlyArray<Stroke>): KeyMatch<T> => {
    const startsWith = ({ binding }: Bound<T>) =>
      strokes.every((stroke, at) => {
        const expected = binding[at]
        return expected !== undefined && sameStroke(stroke, expected)
      })
    const candidates = bound.filter(startsWith)
    const exact = candidates.findLast(({ binding }) => binding.length === strokes.length)
    if (exact !== undefined) return { _tag: "run", value: exact.value }
    return candidates.length > 0 ? { _tag: "wait" } : { _tag: "none" }
  }

  return {
    feed(stroke: Stroke, bound: ReadonlyArray<Bound<T>>): KeyMatch<T> {
      let match = matches(bound, [...pending, stroke])
      // A sequence that went nowhere: the press may still mean something by itself.
      if (match._tag === "none" && pending.length > 0) match = matches(bound, [stroke])
      pending = match._tag === "wait" ? [...pending, stroke] : []
      return match
    },
    reset() {
      pending = []
    },
  }
}

/** Where a key is part of typing or of a control's own keyboard: commands stay out of it. */
const OWNS_KEYS = [
  "input:not([type=checkbox]):not([type=radio])",
  "textarea",
  "select",
  "[contenteditable]:not([contenteditable=false])",
  "[role=textbox]",
  "[role=combobox]",
  "[role=listbox]",
  "[role=menu]",
  "[role=slider]",
  "[role=spinbutton]",
  "[role=tablist]",
  "[role=dialog]",
  "[role=alertdialog]",
].join(",")

/** Enter and Space already press these. */
const PRESSES = "a[href], button, summary, input, [role=button], [role=checkbox], [role=switch], [role=link]"

/** A dialog that is open, wherever focus is: the page behind it is not the one being used. */
const OPEN_DIALOG = "[data-scope=dialog][data-part=content][data-state=open]"

/** Whether a stroke belongs to where focus is, or to an open dialog, rather than to the page's commands. */
export const keysBelongElsewhere = (stroke: Stroke, target: EventTarget | null): boolean => {
  if (typeof document !== "undefined" && document.querySelector(OPEN_DIALOG) !== null) return true
  if (!(target instanceof Element)) return false
  if (target.closest(OWNS_KEYS) !== null) return true
  return (stroke.key === "enter" || stroke.key === " ") && target.closest(PRESSES) !== null
}

const isMac = () => typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform)

const KEY_NAMES: Readonly<Record<string, string>> = {
  arrowdown: "↓",
  arrowup: "↑",
  arrowleft: "←",
  arrowright: "→",
  enter: "↵",
  escape: "Esc",
  backspace: "⌫",
  " ": "Space",
}

/** What to show for a binding, one entry per key to press: "mod+enter" is ["Ctrl", "↵"] or ["⌘", "↵"]. */
export const showKeys = (keys: string): ReadonlyArray<string> =>
  parseKeys(keys).flatMap((stroke) => [
    ...(stroke.mod ? [isMac() ? "⌘" : "Ctrl"] : []),
    ...(stroke.shift ? ["⇧"] : []),
    KEY_NAMES[stroke.key] ?? stroke.key.toUpperCase(),
  ])
