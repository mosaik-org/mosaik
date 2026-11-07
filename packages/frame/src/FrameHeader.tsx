import { children, createContext, type JSX, onCleanup, type ParentProps, useContext } from "solid-js"
import type { FrameHeaderStack } from "./frameHeaderStack"

const FrameHeaderContext = createContext<FrameHeaderStack>()

/** For the frame (the shell): gives the pages inside it a way into its header (`FrameHeader`). */
export const FrameHeaderProvider = (props: ParentProps<{ readonly stack: FrameHeaderStack }>): JSX.Element => (
  <FrameHeaderContext.Provider value={props.stack}>{props.children}</FrameHeaderContext.Provider>
)

/**
 * Shows its children in the frame's header, the shell's top bar, while the page shows it: the page's
 * title, its navigation, its actions. They stay the page's own (its data, its handlers); the
 * deepest page's wins. Without a frame (a standalone page), nothing shows.
 *
 * @example
 * <FrameHeader>
 *   <span class={styles.title}>{order().number}</span>
 * </FrameHeader>
 */
export const FrameHeader = (props: ParentProps): JSX.Element => {
  const stack = useContext(FrameHeaderContext)
  if (stack !== undefined) {
    const content = children(() => props.children)
    onCleanup(stack.show(content))
  }
  return null
}
