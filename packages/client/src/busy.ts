/**
 * Work a page is doing that only this browser tab knows about: a file uploading, a form saving,
 * a reply being written. The shell shows it beside the page in its navigation (where the work
 * started, while the person is elsewhere); work that would be lost can ask the browser to warn
 * before the page is left. It ends with the tab: work the server does is a `running` status.
 */

export interface BusyOptions {
  /** What is going on, e.g. "Uploading 3 files". */
  readonly label: string
  /** Ask the person to confirm before leaving the page while it goes on (it would be lost). */
  readonly keepOpen?: boolean
  /** Where navigation shows it (`/assistant`); the page it started on by default. */
  readonly path?: string
}

export interface BusyMark {
  readonly id: number
  readonly label: string
  /** The page it started on (`/files/inbox`): where navigation shows it. */
  readonly path: string
  readonly keepOpen: boolean
}

let marks: ReadonlyArray<BusyMark> = []
let nextId = 1
const listeners = new Set<(marks: ReadonlyArray<BusyMark>) => void>()

/** Browsers show their own text; asking is what matters. */
const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault()

const change = (next: ReadonlyArray<BusyMark>) => {
  const warned = marks.some((mark) => mark.keepOpen)
  const warns = next.some((mark) => mark.keepOpen)
  marks = next
  if (typeof window !== "undefined" && warned !== warns) {
    if (warns) window.addEventListener("beforeunload", warnBeforeLeaving)
    else window.removeEventListener("beforeunload", warnBeforeLeaving)
  }
  for (const listener of listeners) listener(marks)
}

/**
 * Shows that the page is busy until the returned function is called (calling it again does
 * nothing). Prefer `useBusy` in Solid, which ends it with the component.
 *
 * @example
 * const done = markBusy({ label: "Uploading 3 files", keepOpen: true })
 * try { await upload(files) } finally { done() }
 */
export const markBusy = (options: BusyOptions): (() => void) => {
  const mark: BusyMark = {
    id: nextId++,
    label: options.label,
    path: options.path ?? (typeof location === "undefined" ? "/" : location.pathname),
    keepOpen: options.keepOpen ?? false,
  }
  change([...marks, mark])
  return () => {
    if (marks.includes(mark)) change(marks.filter((other) => other !== mark))
  }
}

/** The work going on in this tab, oldest first. */
export const busyMarks = (): ReadonlyArray<BusyMark> => marks

/** Calls `listener` whenever work starts or ends; returns what stops it. For whatever shows them (the shell). */
export const onBusyChange = (listener: (marks: ReadonlyArray<BusyMark>) => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
