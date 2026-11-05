import { useCan } from "@mosaik/auth/web"
import { useRouter } from "@tanstack/solid-router"
import ArrowRight from "lucide-solid/icons/arrow-right"
import History from "lucide-solid/icons/clock"
import Search from "lucide-solid/icons/search"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  onCleanup,
  onMount,
  useContext,
} from "solid-js"
import { bestScore } from "../fuzzy"
import { withTimeout } from "../loading"
import { createDebounced } from "../primitives"
import { CommandPalette, type PaletteGroup, type PaletteItem } from "./CommandPalette"
import { sourcesToSearch } from "./scope"
import type {
  Command,
  CommandApp,
  Place,
  SearchProvider,
  SearchProviderLoader,
  SearchResult,
  SearchSource,
} from "./types"

const RECENT_KEY = "mosaik-command-recent"
const RECENT_LIMIT = 5
const GROUP_LIMIT = 8

/**
 * How much using an app lifts its commands, in fuzzy score points (about one matched
 * character): it orders equally good matches, it does not beat a clearly better one.
 */
const AFFINITY_WEIGHT = 8

interface CommandRegistry {
  register(commands: Accessor<ReadonlyArray<Command>>): () => void
  open(): void
  findPlaces(query: string): Promise<ReadonlyArray<Place>>
}

const CommandContext = createContext<CommandRegistry>()

const useRegistry = (): CommandRegistry => {
  const registry = useContext(CommandContext)
  if (registry === undefined) throw new Error("useCommands must be used inside <CommandProvider>")
  return registry
}

/**
 * Contributes commands to the palette while the calling component is mounted, so
 * pages can offer contextual actions ("Export orders as CSV") that disappear when
 * the user navigates away.
 */
export const useCommands = (commands: Accessor<ReadonlyArray<Command>>): void => {
  const unregister = useRegistry().register(commands)
  onCleanup(unregister)
}

/** Opens the palette programmatically (e.g. from a search button). */
export const useCommandPalette = () => ({ open: useRegistry().open })

/**
 * Finds the pages and records the person can open, as the palette would for the same words:
 * pages by fuzzy match, records from every app's search provider. For finding places from code,
 * e.g. the assistant linking to them.
 */
export const useFindPlaces = (): ((query: string) => Promise<ReadonlyArray<Place>>) => useRegistry().findPlaces

/** At most this many pages a search for places returns (search providers bring their own). */
const PLACES_PAGE_LIMIT = 8

const readRecent = (): ReadonlyArray<string> => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []
  } catch {
    return []
  }
}

const rememberRecent = (id: string) => {
  try {
    const next = [id, ...readRecent().filter((recent) => recent !== id)].slice(0, RECENT_LIMIT)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Storage may be unavailable: the palette just does not remember.
  }
}

const isShortcut = (event: KeyboardEvent) => (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k"

interface Entry {
  readonly item: PaletteItem
  readonly run: () => unknown
  /** Selecting it changes what the palette shows instead of leaving it. */
  readonly keepOpen?: boolean
  /** The app Tab narrows the search to. */
  readonly app?: CommandApp
}

/** How long a search provider may take to load, and to answer a query. */
const PROVIDER_TIMEOUT_MS = 5000

/**
 * Asks one app's provider (loading it first): `undefined` when the query is too short for it or
 * the person may not see its results. A slow or failing provider fails only this search.
 */
const askProvider = async (
  source: SearchSource,
  term: string,
  can: (permission: string) => boolean,
): Promise<Found | undefined> => {
  const provider = await loadProvider(source.load)
  if (term.length < (provider.minQueryLength ?? 2)) return undefined
  if (provider.permission !== undefined && !can(provider.permission)) return undefined
  const results = await withTimeout(provider.search(term), PROVIDER_TIMEOUT_MS, `${provider.group} search timed out`)
  return { source, provider, results }
}

/**
 * Providers load on first use (each is a separate chunk) and stay loaded. One that fails
 * to load is tried again on the next search.
 */
const loadedProviders = new Map<SearchProviderLoader, Promise<SearchProvider>>()
const loadProvider = (load: SearchProviderLoader): Promise<SearchProvider> => {
  let provider = loadedProviders.get(load)
  if (provider === undefined) {
    provider = withTimeout(load(), PROVIDER_TIMEOUT_MS, "A search provider took too long to load")
    provider.catch(() => loadedProviders.delete(load))
    loadedProviders.set(load, provider)
  }
  return provider
}

export interface CommandProviderProps {
  /** Search providers, each searching one app's data. */
  sources?: ReadonlyArray<SearchSource>
  /**
   * How much the user uses an app, from 0 to 1: ranks its commands, and with many apps
   * decides which are searched without asking ("Search all apps" covers the rest).
   */
  affinity?: (app: string) => number
  children: JSX.Element
}

type Found = {
  readonly source: SearchSource
  readonly provider: SearchProvider
  readonly results: ReadonlyArray<SearchResult>
}

/**
 * Command palette (Ctrl/⌘+K) for everything inside it: registered commands, matched
 * fuzzily and ranked, plus results from apps' search providers. Tab on an app's command
 * searches only that app; Backspace in an empty search goes back to everything.
 */
export const CommandProvider = (props: CommandProviderProps) => {
  const router = useRouter()
  const can = useCan()
  const affinity = (app: string | undefined) => (app === undefined ? 0 : (props.affinity?.(app) ?? 0))
  const [sources, setSources] = createSignal<ReadonlyArray<Accessor<ReadonlyArray<Command>>>>([])
  const [open, setOpen] = createSignal(false)
  const [query, setQuery] = createSignal("")
  const [scope, setScope] = createSignal<CommandApp>()
  const [everything, setEverything] = createSignal(false)
  const [recent, setRecent] = createSignal<ReadonlyArray<string>>([])
  const [results, setResults] = createSignal<ReadonlyArray<Found>>([])
  const [skipped, setSkipped] = createSignal(0)
  const [searching, setSearching] = createSignal(false)

  const commands = createMemo(() => sources().flatMap((source) => source()))

  const registry: CommandRegistry = {
    register: (commands) => {
      setSources((current) => [...current, commands])
      return () => setSources((current) => current.filter((source) => source !== commands))
    },
    open: () => setOpen(true),
    findPlaces: async (query) => {
      const term = query.trim()
      const pages = commands()
        .flatMap((command) => {
          if (command.to === undefined) return []
          const score = bestScore(term, [command.title, command.hint ?? "", ...(command.keywords ?? [])])
          return score === null
            ? []
            : [{ command, to: command.to, score: score + AFFINITY_WEIGHT * affinity(command.app?.id) }]
        })
        .toSorted((a, b) => b.score - a.score)
        .slice(0, PLACES_PAGE_LIMIT)
        .map(
          ({ command, to }): Place => ({
            title: command.title,
            ...(command.hint === undefined ? {} : { subtitle: command.hint }),
            group: "Pages",
            to,
          }),
        )
      // Every app's provider: a search from code is not typed key by key, so it can ask them all.
      const { searched } = sourcesToSearch(props.sources ?? [], { app: undefined, everything: true, affinity })
      const answers = await Promise.allSettled(searched.map((source) => askProvider(source, term, can)))
      const records = answers.flatMap((answer) => {
        if (answer.status === "rejected" || answer.value === undefined) return []
        const { provider, results } = answer.value
        return results.map(
          (result): Place => ({
            title: result.title,
            ...(result.subtitle === undefined ? {} : { subtitle: result.subtitle }),
            group: provider.group,
            to: result.to,
          }),
        )
      })
      return [...pages, ...records]
    },
  }

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isShortcut(event)) return
      event.preventDefault()
      setOpen((current) => !current)
    }
    window.addEventListener("keydown", onKeyDown)
    onCleanup(() => window.removeEventListener("keydown", onKeyDown))
  })

  createEffect(
    on(open, (isOpen) => {
      if (!isOpen) return
      setQuery("")
      setScope(undefined)
      setEverything(false)
      setResults([])
      setRecent(readRecent())
    }),
  )

  const debouncedQuery = createDebounced(query, 200)
  let searchId = 0
  createEffect(
    on([debouncedQuery, open, scope, everything], ([text, isOpen, scoped, all]) => {
      const id = ++searchId
      const term = text.trim()
      setSearching(false)
      // Providers load the first time the palette opens.
      if (!isOpen) return
      const { searched, skipped } = sourcesToSearch(props.sources ?? [], {
        app: scoped?.id,
        everything: all,
        affinity,
      })
      setSkipped(skipped)
      // Each provider loads and answers on its own: a failing or slow one only leaves its results out.
      const found: Array<Found | undefined> = []
      // Providers ask for two characters at least, unless they say otherwise.
      setSearching(searched.length > 0 && term.length >= 2)
      const searches = searched.map(async (source, index) => {
        const answer = await askProvider(source, term, can)
        if (id !== searchId || answer === undefined) return
        found[index] = answer
        setResults(found.filter((entry) => entry !== undefined))
      })
      void Promise.allSettled(searches).then((outcomes) => {
        for (const outcome of outcomes) {
          if (outcome.status === "rejected") console.warn("A search provider failed", outcome.reason)
        }
        // A newer query superseded this one.
        if (id !== searchId) return
        setResults(found.filter((entry) => entry !== undefined))
        setSearching(false)
      })
    }),
  )

  const groups = createMemo(() => {
    const term = query().trim()
    const scoped = scope()
    const entries = new Map<string, Array<Entry & { score: number }>>()
    const add = (group: string, entry: Entry, score: number) => {
      const list = entries.get(group) ?? []
      list.push({ ...entry, score })
      entries.set(group, list)
    }

    const toEntry = (command: Command): Entry => ({
      item: {
        id: command.id,
        title: command.title,
        subtitle: command.subtitle,
        icon: command.icon,
        hint: command.hint,
        ...(command.app === undefined || scoped !== undefined ? {} : { tabHint: `Search in ${command.app.name}` }),
      },
      run: () => {
        rememberRecent(command.id)
        return command.perform()
      },
      ...(command.app === undefined ? {} : { app: command.app }),
    })

    const inScope = commands().filter((command) => scoped === undefined || command.app?.id === scoped.id)

    if (term.length === 0 && scoped === undefined) {
      const byId = new Map(inScope.map((command) => [command.id, command]))
      for (const id of recent()) {
        const command = byId.get(id)
        if (command === undefined) continue
        const entry = toEntry(command)
        add("Recent", { ...entry, item: { ...entry.item, icon: <History size={16} /> } }, 0)
      }
    }

    for (const command of inScope) {
      const match =
        term.length === 0 ? 0 : bestScore(term, [command.title, command.hint ?? "", ...(command.keywords ?? [])])
      if (match !== null) add(command.group, toEntry(command), match + AFFINITY_WEIGHT * affinity(command.app?.id))
    }

    // Apps the user uses more come first.
    const answered = results().toSorted((a, b) => affinity(b.source.app) - affinity(a.source.app))
    for (const { provider, results: found } of answered) {
      for (const result of found) {
        add(
          provider.group,
          {
            item: {
              id: `${provider.id}:${result.id}`,
              title: result.title,
              subtitle: result.subtitle,
              icon: result.icon ?? <ArrowRight size={16} />,
            },
            run: () => router.history.push(result.to),
          },
          0,
        )
      }
    }

    if (term.length >= 2 && skipped() > 0) {
      add(
        "Search",
        {
          item: {
            id: "search:everything",
            title: `Search all apps for “${term}”`,
            subtitle: `${skipped()} more ${skipped() === 1 ? "app" : "apps"}`,
            icon: <Search size={16} />,
          },
          run: () => setEverything(true),
          keepOpen: true,
        },
        0,
      )
    }

    return [...entries].map(([label, list]) => ({
      label,
      // `toSorted` is stable: commands that score the same keep their order.
      entries: list.toSorted((a, b) => b.score - a.score).slice(0, GROUP_LIMIT),
    }))
  })

  const paletteGroups = (): ReadonlyArray<PaletteGroup> =>
    groups().map((group) => ({ id: group.label, label: group.label, items: group.entries.map((entry) => entry.item) }))

  const entryOf = (item: PaletteItem) =>
    groups()
      .flatMap((group) => group.entries)
      .find((candidate) => candidate.item === item)

  const select = (item: PaletteItem) => {
    const entry = entryOf(item)
    if (entry?.keepOpen !== true) setOpen(false)
    void entry?.run()
  }

  const narrow = (item: PaletteItem) => {
    const app = entryOf(item)?.app
    if (app === undefined) return
    setScope(app)
    setQuery("")
  }

  return (
    <CommandContext.Provider value={registry}>
      {props.children}
      <CommandPalette
        open={open()}
        onOpenChange={setOpen}
        query={query()}
        onQueryChange={setQuery}
        groups={paletteGroups()}
        onSelect={select}
        onTab={narrow}
        scope={scope()?.name}
        onClearScope={() => setScope(undefined)}
        placeholder={scope() === undefined ? undefined : `Search in ${scope()?.name}…`}
        loading={searching()}
      />
    </CommandContext.Provider>
  )
}
