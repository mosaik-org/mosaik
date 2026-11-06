import { type Component, createMemo, createResource, createSignal, For, onCleanup, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { css } from "styled-system/css"
import * as recipes from "styled-system/recipes"
import { IconButton } from "../src/components/icon-button"
import { CheckIcon, CopyIcon, SearchIcon } from "../src/components/icons"
import { Input } from "../src/components/input"
import { InputGroup } from "../src/components/input-group"
import { Toaster } from "../src/components/toast"
import { Tooltip } from "../src/components/tooltip"
import { SelectField } from "../src/fields/choice-fields"
import { ThemeProvider, ThemeToggle } from "../src/patterns/theme"
import { palettes } from "../src/theme/colors"
import { COLOR_PAGE, Colors } from "./colors"
import { GROUPS } from "./nav"
import { bySize } from "./showcase"

/**
 * Every example: `examples/<component>/<example>.tsx`, each exporting `App`, loaded with its page.
 * All at once they are hundreds of modules on every page, more than a browser keeps up with.
 */
const modules = import.meta.glob<{ App: Component }>("./examples/*/*.tsx")
const sources = import.meta.glob<string>("./examples/*/*.tsx", { query: "?raw", import: "default" })

const title = (slug: string) => slug.replaceAll("-", " ").replace(/^./, (first) => first.toUpperCase())

const pathOf = (component: string, example: string) => `./examples/${component}/${example}.tsx`

const components = new Map<string, Array<string>>()
for (const path of Object.keys(modules)) {
  const [, component = "", file = ""] = path.match(/\.\/examples\/([^/]+)\/([^/]+)\.tsx$/) ?? []
  components.set(component, [...(components.get(component) ?? []), file])
}
for (const examples of components.values()) {
  examples.sort((a, b) => (a === "basic" ? -1 : b === "basic" ? 1 : a.localeCompare(b)))
}

/** The demo: a screen of a made-up app built from the components, shown first. */
const DEMO = "demo"
const fromHash = () => decodeURIComponent(location.hash.slice(2)).split("/")[0] || DEMO

interface Loaded {
  readonly name: string
  readonly App: Component
}

const loadExamples = async (component: string): Promise<ReadonlyArray<Loaded>> =>
  Promise.all(
    (components.get(component) ?? []).map(async (name) => {
      const load = modules[pathOf(component, name)]
      if (load === undefined) throw new Error(`No example ${component}/${name}`)
      return { name, App: (await load()).App }
    }),
  )

const Demo = () => {
  const [demo] = createResource(() => import("./demo"))
  return (
    <Show when={demo()} fallback={<Loading />}>
      {(module) => <Dynamic component={module().App} />}
    </Show>
  )
}

const Loading = () => <p class={css({ textStyle: "sm", color: "fg.muted" })}>Loading…</p>

const styles = {
  layout: css({
    display: "grid",
    gridTemplateColumns: { base: "minmax(0, 1fr)", md: "16rem minmax(0, 1fr)" },
    minH: "100dvh",
    bg: "canvas",
    color: "fg.default",
  }),
  sidebar: css({
    display: "flex",
    flexDirection: "column",
    minH: "0",
    bg: "canvas.sunken",
    borderBottomWidth: { base: "1px", md: "0" },
    borderRightWidth: { md: "1px" },
    maxH: { base: "40dvh", md: "100dvh" },
    position: { md: "sticky" },
    top: "0",
    h: { md: "100dvh" },
  }),
  brand: css({ display: "flex", alignItems: "center", gap: "2", px: "4", pt: "4", pb: "3", fontWeight: "semibold" }),
  mark: css({
    display: "grid",
    placeItems: "center",
    boxSize: "7",
    borderRadius: "md",
    bg: "accent.solid.bg",
    color: "accent.solid.fg",
    textStyle: "sm",
  }),
  search: css({ px: "3", pb: "3" }),
  nav: css({
    display: "flex",
    flexDirection: "column",
    gap: "4",
    flex: "1",
    minH: "0",
    overflowY: "auto",
    px: "3",
    pb: "6",
  }),
  group: css({ display: "flex", flexDirection: "column", gap: "0.5" }),
  groupLabel: css({
    px: "2",
    pb: "1",
    textStyle: "xs",
    fontWeight: "semibold",
    color: "fg.subtle",
    textTransform: "uppercase",
    letterSpacing: "wider",
  }),
  link: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    px: "2",
    py: "1",
    borderRadius: "l2",
    textStyle: "sm",
    color: "fg.muted",
    _hover: { bg: "gray.subtle.bg", color: "fg.default" },
    _focusVisible: { outline: "2px solid", outlineColor: "accent.solid.bg", outlineOffset: "-2px" },
    "&[aria-current=page]": { bg: "gray.subtle.bg.hover", color: "fg.default", fontWeight: "medium" },
  }),
  count: css({ textStyle: "xs", color: "fg.subtle" }),
  none: css({ px: "2", textStyle: "sm", color: "fg.muted" }),
  main: css({ display: "flex", flexDirection: "column", minW: "0" }),
  topBar: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "2",
    position: "sticky",
    top: "0",
    zIndex: "sticky",
    px: { base: "4", md: "8" },
    py: "2",
    bg: "canvas/80",
    backdropFilter: "blur(12px)",
    borderBottomWidth: "1px",
  }),
  page: css({
    display: "flex",
    flexDirection: "column",
    gap: "8",
    w: "full",
    maxW: "5xl",
    mx: "auto",
    p: { base: "4", md: "8" },
  }),
  heading: css({ textStyle: "3xl", fontWeight: "semibold", letterSpacing: "-0.01em" }),
  variants: css({ display: "flex", flexWrap: "wrap", columnGap: "6", rowGap: "1", mt: "3" }),
  variant: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: "1.5",
    textStyle: "xs",
    color: "fg.muted",
  }),
  variantName: css({ fontWeight: "medium", color: "fg.default" }),
  jump: css({ display: "flex", flexWrap: "wrap", gap: "1", mt: "4" }),
  jumpLink: css({
    px: "2",
    py: "0.5",
    borderRadius: "full",
    borderWidth: "1px",
    textStyle: "xs",
    color: "fg.muted",
    _hover: { bg: "gray.subtle.bg", color: "fg.default" },
  }),
  example: css({ scrollMarginTop: "16" }),
  exampleHead: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "2",
    mb: "2",
    minH: "7",
  }),
  exampleTitle: css({ textStyle: "sm", fontWeight: "medium" }),
  frame: css({ borderWidth: "1px", borderRadius: "l3", overflow: "hidden", bg: "gray.surface.bg" }),
  // Faint dots, so that what has no background of its own still shows where it ends.
  preview: css({
    p: { base: "4", md: "6" },
    minW: "0",
    backgroundImage: "radial-gradient(circle, token(colors.gray.4) 1px, transparent 1px)",
    backgroundSize: "16px 16px",
  }),
  code: css({
    position: "relative",
    borderTopWidth: "1px",
    bg: "gray.2",
    fontFamily: "mono",
    textStyle: "xs",
    maxH: "96",
    overflow: "auto",
    p: "4",
    whiteSpace: "pre",
    tabSize: 2,
  }),
}

const CopyButton = (props: { readonly text: () => string | undefined }) => {
  const [copied, setCopied] = createSignal(false)
  return (
    <Tooltip content={copied() ? "Copied" : "Copy the code"}>
      {(trigger) => (
        <IconButton
          {...trigger()}
          size="xs"
          variant="plain"
          aria-label="Copy the code"
          onClick={async () => {
            await navigator.clipboard.writeText(props.text() ?? "")
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          <Show when={copied()} fallback={<CopyIcon />}>
            <CheckIcon />
          </Show>
        </IconButton>
      )}
    </Tooltip>
  )
}

const CodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <path d="m16 18 6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
    <path d="m8 6-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
)

const Example = (props: { readonly component: string; readonly example: Loaded }) => {
  const [showCode, setShowCode] = createSignal(false)
  const [source] = createResource(showCode, async () => sources[pathOf(props.component, props.example.name)]?.())
  return (
    <section id={props.example.name} data-example={`${props.component}/${props.example.name}`} class={styles.example}>
      <div class={styles.exampleHead}>
        <h2 class={styles.exampleTitle}>{title(props.example.name)}</h2>
        <span class={css({ display: "flex", gap: "0.5" })}>
          <Show when={showCode()}>
            <CopyButton text={source} />
          </Show>
          <Tooltip content={showCode() ? "Hide the code" : "Show the code"}>
            {(trigger) => (
              <IconButton
                {...trigger()}
                size="xs"
                variant="plain"
                aria-label={showCode() ? "Hide the code" : "Show the code"}
                aria-pressed={showCode()}
                onClick={() => setShowCode(!showCode())}
              >
                <CodeIcon />
              </IconButton>
            )}
          </Tooltip>
        </span>
      </div>
      <div class={styles.frame}>
        <div class={styles.preview}>
          <Dynamic component={props.example.App} />
        </div>
        <Show when={showCode()}>
          <pre class={styles.code}>{source() ?? "Loading…"}</pre>
        </Show>
      </div>
    </section>
  )
}

/** What a component's recipe offers, read from the recipe: `size` and its values, and so on. */
const variantsOf = (slug: string): ReadonlyArray<readonly [string, ReadonlyArray<string>]> => {
  const name = slug.replace(/-(.)/g, (_, letter: string) => letter.toUpperCase())
  const all = recipes as unknown as Record<string, { variantMap?: Record<string, ReadonlyArray<string>> }>
  const map = (all[name] ?? all[`${name}Recipe`])?.variantMap ?? {}
  return Object.entries(map).filter(([, values]) => values.length > 1)
}

const ComponentPage = (props: { readonly component: string }) => {
  const [examples] = createResource(() => props.component, loadExamples)
  return (
    <div class={styles.page}>
      <header>
        <h1 class={styles.heading}>{title(props.component)}</h1>
        <Show when={variantsOf(props.component).length > 0}>
          <div class={styles.variants}>
            <For each={variantsOf(props.component)}>
              {([key, values]) => (
                <span class={styles.variant}>
                  <span class={styles.variantName}>{key}</span>
                  {(key === "size" ? bySize(values) : values).join(" · ")}
                </span>
              )}
            </For>
          </div>
        </Show>
        <nav class={styles.jump} aria-label="Examples on this page">
          <For each={components.get(props.component) ?? []}>
            {(name) => (
              <a
                class={styles.jumpLink}
                href={`#/${props.component}`}
                onClick={(event) => {
                  event.preventDefault()
                  document.getElementById(name)?.scrollIntoView({ behavior: "smooth", block: "start" })
                }}
              >
                {title(name)}
              </a>
            )}
          </For>
        </nav>
      </header>
      <Show when={examples()} fallback={<Loading />}>
        {(list) => <For each={list()}>{(example) => <Example component={props.component} example={example} />}</For>}
      </Show>
    </div>
  )
}

export const Catalog = () => {
  const [current, setCurrent] = createSignal(fromHash())
  const onHash = () => {
    setCurrent(fromHash())
    window.scrollTo({ top: 0 })
  }
  window.addEventListener("hashchange", onHash)
  onCleanup(() => window.removeEventListener("hashchange", onHash))

  const [accent, setAccent] = createSignal<string>("indigo")
  const [query, setQuery] = createSignal("")
  const matches = (name: string) => title(name).toLowerCase().includes(query().trim().toLowerCase())

  const groups = createMemo(() => [
    { label: "Start here", items: [DEMO, COLOR_PAGE] },
    ...GROUPS.map((group) => ({ label: group.label, items: group.items.filter((name) => components.has(name)) })),
  ])
  const shown = createMemo(() =>
    groups()
      .map((group) => ({ label: group.label, items: group.items.filter(matches) }))
      .filter((group) => group.items.length > 0),
  )
  const countOf = (name: string) => components.get(name)?.length

  return (
    <ThemeProvider>
      <div class={styles.layout}>
        <aside class={styles.sidebar}>
          <div class={styles.brand}>
            <span class={styles.mark}>M</span> Mosaik UI
          </div>
          <div class={styles.search}>
            <InputGroup startElement={<SearchIcon />}>
              <Input
                type="search"
                placeholder="Find a component"
                aria-label="Find a component"
                value={query()}
                onInput={(event) => setQuery(event.currentTarget.value)}
              />
            </InputGroup>
          </div>
          <nav class={styles.nav} aria-label="Components">
            <For each={shown()} fallback={<p class={styles.none}>Nothing by that name.</p>}>
              {(group) => (
                <div class={styles.group}>
                  <span class={styles.groupLabel}>{group.label}</span>
                  <For each={group.items}>
                    {(name) => (
                      <a href={`#/${name}`} class={styles.link} aria-current={name === current() ? "page" : undefined}>
                        {title(name)}
                        <Show when={countOf(name)}>{(count) => <span class={styles.count}>{count()}</span>}</Show>
                      </a>
                    )}
                  </For>
                </div>
              )}
            </For>
          </nav>
        </aside>
        <div class={styles.main}>
          <div class={styles.topBar}>
            <SelectField
              aria-label="Accent"
              size="sm"
              class={css({ width: "32" })}
              items={Object.keys(palettes)}
              value={accent()}
              onValueChange={(value) => value !== null && setAccent(value)}
            />
            <ThemeToggle />
          </div>
          <main class={css({ colorPalette: "accent" })} data-palette={accent()} style={paletteVars(accent())}>
            <Show when={current() === DEMO}>
              {/* A whole screen of an app: as wide as one. */}
              <div class={styles.page} style={{ "max-width": "none" }}>
                <Demo />
              </div>
            </Show>
            <Show when={current() === COLOR_PAGE}>
              <div class={styles.page}>
                <Colors />
              </div>
            </Show>
            <Show when={current() !== DEMO && current() !== COLOR_PAGE && current()} keyed>
              {(component) => (
                <Show when={components.has(component)} fallback={<div class={styles.page}>No such component.</div>}>
                  <ComponentPage component={component} />
                </Show>
              )}
            </Show>
          </main>
        </div>
      </div>
      <Toaster />
    </ThemeProvider>
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
