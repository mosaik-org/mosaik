import { type Accessor, createSignal, type JSX } from "solid-js"

/**
 * What pages show in the frame's header, the latest one shown first: a layout route can show the
 * app's name, and a page under it replace it while it is open (the layout's comes back after).
 */
export interface FrameHeaderStack {
  /** What the header shows now, if anything. */
  readonly current: Accessor<JSX.Element | undefined>
  /** Shows `content` until the returned function is called. */
  readonly show: (content: Accessor<JSX.Element>) => () => void
}

export const createFrameHeaderStack = (): FrameHeaderStack => {
  const [shown, setShown] = createSignal<ReadonlyArray<Accessor<JSX.Element>>>([])
  return {
    current: () => shown().at(-1)?.(),
    show: (content) => {
      setShown((all) => [...all, content])
      return () => setShown((all) => all.filter((each) => each !== content))
    },
  }
}
