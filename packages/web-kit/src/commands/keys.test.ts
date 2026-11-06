// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { createKeyMatcher, isCharacterBinding, keysBelongElsewhere, parseKeys, showKeys, strokeOf } from "./keys"

const press = (key: string, modifiers: Partial<KeyboardEvent> = {}) =>
  strokeOf({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...modifiers })

const bound = (...keys: ReadonlyArray<string>) => keys.map((value) => ({ binding: parseKeys(value), value }))

describe("strokeOf", () => {
  it("takes the character typed, so a binding follows the keyboard's layout", () => {
    expect(press("J", { shiftKey: true })).toEqual({ key: "j", mod: false, shift: true })
    expect(press("?", { shiftKey: true })).toEqual({ key: "?", mod: false, shift: false })
  })

  it("ignores modifiers pressed alone, and anything typed with Alt, as AltGr types letters", () => {
    expect(press("Shift")).toBeUndefined()
    expect(press("ą", { altKey: true, ctrlKey: true })).toBeUndefined()
  })

  it("treats ⌘ and Ctrl alike", () => {
    expect(press("Enter", { metaKey: true })).toEqual(press("Enter", { ctrlKey: true }))
  })
})

describe("createKeyMatcher", () => {
  const stroke = (key: string) => press(key) as NonNullable<ReturnType<typeof press>>

  it("runs a single key", () => {
    expect(createKeyMatcher<string>().feed(stroke("a"), bound("a"))).toEqual({ _tag: "run", value: "a" })
  })

  it("waits for the rest of a sequence", () => {
    const matcher = createKeyMatcher<string>()
    expect(matcher.feed(stroke("g"), bound("g i"))).toEqual({ _tag: "wait" })
    expect(matcher.feed(stroke("i"), bound("g i"))).toEqual({ _tag: "run", value: "g i" })
  })

  it("starts over when a sequence goes nowhere, and still takes the key that ended it", () => {
    const matcher = createKeyMatcher<string>()
    matcher.feed(stroke("g"), bound("g i", "a"))
    expect(matcher.feed(stroke("a"), bound("g i", "a"))).toEqual({ _tag: "run", value: "a" })
  })

  it("forgets a sequence once reset", () => {
    const matcher = createKeyMatcher<string>()
    matcher.feed(stroke("g"), bound("g i"))
    matcher.reset()
    expect(matcher.feed(stroke("i"), bound("g i"))).toEqual({ _tag: "none" })
  })

  it("lets what was registered last win", () => {
    const later = [
      { binding: parseKeys("a"), value: "layout" },
      { binding: parseKeys("a"), value: "page" },
    ]
    expect(createKeyMatcher<string>().feed(stroke("a"), later)).toEqual({ _tag: "run", value: "page" })
  })
})

describe("isCharacterBinding", () => {
  it("is true only for plain characters, which people must be able to turn off", () => {
    expect(isCharacterBinding(parseKeys("a"))).toBe(true)
    expect(isCharacterBinding(parseKeys("g i"))).toBe(true)
    expect(isCharacterBinding(parseKeys("?"))).toBe(true)
    expect(isCharacterBinding(parseKeys("mod+z"))).toBe(false)
    expect(isCharacterBinding(parseKeys("arrowdown"))).toBe(false)
  })
})

describe("keysBelongElsewhere", () => {
  const a = press("a") as NonNullable<ReturnType<typeof press>>
  const enter = press("Enter") as NonNullable<ReturnType<typeof press>>
  const element = (html: string) => {
    document.body.innerHTML = html
    return document.body.firstElementChild
  }

  it("leaves typing alone", () => {
    expect(keysBelongElsewhere(a, element("<input />"))).toBe(true)
    expect(keysBelongElsewhere(a, element("<textarea></textarea>"))).toBe(true)
    expect(keysBelongElsewhere(a, element("<div contenteditable></div>"))).toBe(true)
  })

  it("does not count a checkbox as typing", () => {
    expect(keysBelongElsewhere(a, element('<input type="checkbox" />'))).toBe(false)
  })

  it("leaves Enter to what it presses, and takes other keys there", () => {
    expect(keysBelongElsewhere(enter, element("<button></button>"))).toBe(true)
    expect(keysBelongElsewhere(a, element("<button></button>"))).toBe(false)
    expect(keysBelongElsewhere(enter, element('<div tabindex="0"></div>'))).toBe(false)
  })

  it("stays out of the way while a dialog is open, wherever focus is", () => {
    document.body.innerHTML = '<div data-scope="dialog" data-part="content" data-state="open"></div><main></main>'
    expect(keysBelongElsewhere(a, document.querySelector("main"))).toBe(true)
  })
})

describe("showKeys", () => {
  it("lists one entry per key to press", () => {
    expect(showKeys("g i")).toEqual(["G", "I"])
    expect(showKeys("shift+j")).toEqual(["⇧", "J"])
    expect(showKeys("escape")).toEqual(["Esc"])
    expect(showKeys("mod+enter").at(-1)).toBe("↵")
  })
})
