import { type Component, createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { css } from "styled-system/css"
import { Toaster } from "../src/components/toast"
import { palettes } from "../src/theme/colors"
import { App as Demo } from "./demo"

/** Every example: `examples/<component>/<example>.tsx`, each exporting `App`. */
const modules = import.meta.glob<{ App: Component }>("./examples/*/*.tsx", { eager: true })

interface Example {
  readonly name: string
  readonly App: Component
}

const title = (slug: string) => slug.replaceAll("-", " ").replace(/^./, (first) => first.toUpperCase())

const components = new Map<string, Array<Example>>()
for (const [path, module] of Object.entries(modules)) {
  const [, component = "", file = ""] = path.match(/\.\/examples\/([^/]+)\/([^/]+)\.tsx$/) ?? []
  if (!module.App) continue
  const examples = components.get(component) ?? []
  examples.push({ name: file, App: module.App })
  components.set(component, examples)
}
for (const examples of components.values()) {
  examples.sort((a, b) => (a.name === "basic" ? -1 : b.name === "basic" ? 1 : a.name.localeCompare(b.name)))
}
const names = [...components.keys()].sort()

/** The demo: a screen of a made-up app built from the components, shown first. */
const DEMO = "demo"
const fromHash = () => decodeURIComponent(location.hash.slice(2)) || DEMO

export const Catalog = () => {
  const [current, setCurrent] = createSignal(fromHash())
  const onHash = () => setCurrent(fromHash())
  window.addEventListener("hashchange", onHash)
  onCleanup(() => window.removeEventListener("hashchange", onHash))

  const [dark, setDark] = createSignal(document.documentElement.classList.contains("dark"))
  const toggleDark = () => {
    setDark(!dark())
    document.documentElement.classList.toggle("dark", dark())
  }
  const [accent, setAccent] = createSignal("indigo")

  const examples = createMemo(() => components.get(current()) ?? [])

  return (
    <div class={css({ display: "grid", gridTemplateColumns: "220px 1fr", minH: "100vh" })}>
      <nav
        aria-label="Components"
        class={css({
          borderRightWidth: "1px",
          p: "4",
          position: "sticky",
          top: "0",
          h: "100vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.5",
        })}
      >
        <strong class={css({ textStyle: "lg", mb: "3" })}>Mosaik UI</strong>
        <For each={[DEMO, ...names]}>
          {(name) => (
            <a
              href={`#/${name}`}
              aria-current={name === current() ? "page" : undefined}
              class={css({
                px: "2",
                py: "1",
                borderRadius: "l2",
                textStyle: "sm",
                color: "fg.muted",
                _hover: { bg: "gray.subtle.bg" },
                "&[aria-current=page]": { bg: "gray.subtle.bg.active", color: "fg.default", fontWeight: "medium" },
                // The demo, apart from the components.
                [`&[href="#/${DEMO}"]`]: { mb: "3" },
              })}
            >
              {title(name)}
            </a>
          )}
        </For>
      </nav>
      <main class={css({ p: "8", display: "flex", flexDirection: "column", gap: "8", minW: "0" })}>
        <header class={css({ display: "flex", alignItems: "center", gap: "4" })}>
          <h1 class={css({ textStyle: "3xl", fontWeight: "semibold", flex: "1" })}>{title(current())}</h1>
          <label class={css({ display: "flex", gap: "2", alignItems: "center", textStyle: "sm" })}>
            Accent
            <select
              data-testid="accent"
              value={accent()}
              onChange={(event) => setAccent(event.currentTarget.value)}
              class={css({ borderWidth: "1px", borderRadius: "l2", px: "2", py: "1", bg: "canvas" })}
            >
              <For each={Object.keys(palettes)}>{(palette) => <option value={palette}>{palette}</option>}</For>
            </select>
          </label>
          <button
            type="button"
            data-testid="theme"
            onClick={toggleDark}
            class={css({ borderWidth: "1px", borderRadius: "l2", px: "3", py: "1", textStyle: "sm" })}
          >
            {dark() ? "Light" : "Dark"}
          </button>
        </header>
        <div class={css({ colorPalette: "accent" })} data-palette={accent()} style={{ ...paletteVars(accent()) }}>
          <Show when={current() === DEMO}>
            <Demo />
          </Show>
          <For each={examples()}>
            {(example) => (
              <section id={example.name} data-example={`${current()}/${example.name}`} class={css({ mb: "8" })}>
                <h2 class={css({ textStyle: "sm", fontWeight: "medium", color: "fg.muted", mb: "3" })}>
                  {title(example.name)}
                </h2>
                <div class={css({ borderWidth: "1px", borderRadius: "l3", p: "6", bg: "canvas" })}>
                  <Dynamic component={example.App} />
                </div>
              </section>
            )}
          </For>
          <Show when={examples().length === 0 && current() !== DEMO}>
            <p>No examples.</p>
          </Show>
        </div>
      </main>
      <Toaster />
    </div>
  )
}

/** Points the `accent` role at another palette for the examples, as an app's theme would. */
const paletteVars = (palette: string): Record<string, string> => {
  const vars: Record<string, string> = {}
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    collect(rules, palette, vars)
  }
  return vars
}

const collect = (rules: CSSRuleList, palette: string, vars: Record<string, string>) => {
  for (const rule of Array.from(rules)) {
    if ("cssRules" in rule && rule.cssRules) collect(rule.cssRules as CSSRuleList, palette, vars)
    if (!(rule instanceof CSSStyleRule)) continue
    for (const property of Array.from(rule.style)) {
      if (property.startsWith("--mk-colors-accent-")) {
        vars[property] = `var(--mk-colors-${palette}-${property.slice("--mk-colors-accent-".length)})`
      }
    }
  }
}
