import { Tooltip as ArkTooltip } from "@ark-ui/solid/tooltip"
import { type ComponentProps, type JSX, Show, splitProps } from "solid-js"
import { Portal } from "solid-js/web"
import { createSlotRecipeContext } from "../../styled-system/jsx"
import { tooltip } from "../../styled-system/recipes"

const { withRootProvider, withContext } = createSlotRecipeContext(tooltip)

type RootProps = ComponentProps<typeof Root>
type ContentProps = ComponentProps<typeof Content>
const Root = withRootProvider(ArkTooltip.Root, {
  defaultProps: () => ({ unmountOnExit: true, lazyMount: true }),
})
const Arrow = withContext(ArkTooltip.Arrow, "arrow")
const ArrowTip = withContext(ArkTooltip.ArrowTip, "arrowTip")
const Content = withContext(ArkTooltip.Content, "content")
const Positioner = withContext(ArkTooltip.Positioner, "positioner")
const Trigger = withContext(ArkTooltip.Trigger, "trigger")

export { TooltipContext as Context } from "@ark-ui/solid/tooltip"

/** The trigger's props (events, ARIA), for the element the tooltip describes. */
export type TooltipTriggerProps = () => JSX.HTMLAttributes<HTMLButtonElement>

export interface TooltipProps extends Omit<RootProps, "content" | "children"> {
  showArrow?: boolean
  portalled?: boolean
  portalRef?: HTMLElement | undefined
  /**
   * What the tooltip describes. A function gets the trigger's props to spread on its own element:
   * `{(trigger) => <IconButton {...trigger()} />}`, the accessible way for a focusable element. Any
   * other child is wrapped in a `<span>` that shows the tooltip on hover and when focus enters it.
   */
  children: JSX.Element | ((trigger: TooltipTriggerProps) => JSX.Element) | undefined
  content: JSX.Element | string
  contentProps?: ContentProps
  disabled?: boolean
}

export const Tooltip = (props: TooltipProps) => {
  const [local, rootProps] = splitProps(props, [
    "showArrow",
    "children",
    "disabled",
    "portalled",
    "content",
    "contentProps",
    "portalRef",
  ])

  const portalled = () => local.portalled ?? true

  return (
    <Show
      when={!local.disabled}
      fallback={
        typeof local.children === "function" && local.children.length > 0
          ? (local.children as (trigger: TooltipTriggerProps) => JSX.Element)(() => ({}))
          : (local.children as JSX.Element)
      }
    >
      <Root {...rootProps}>
        <Trigger
          asChild={(trigger) => {
            const children = local.children
            if (typeof children === "function" && children.length > 0) {
              return (children as (trigger: TooltipTriggerProps) => JSX.Element)(trigger)
            }
            // Not a button around the child (which is often one): a span that hears focus enter it.
            const {
              type: _type,
              onFocus,
              onBlur,
              ...rest
            } = trigger() as JSX.HTMLAttributes<HTMLElement> & {
              type?: string
            }
            return (
              <span {...rest} style={{ display: "inline-flex" }} onFocusIn={onFocus} onFocusOut={onBlur}>
                {children as JSX.Element}
              </span>
            )
          }}
        />
        <Show
          when={portalled()}
          fallback={
            <Positioner>
              <Content {...local.contentProps}>
                <Show when={local.showArrow}>
                  <Arrow>
                    <ArrowTip />
                  </Arrow>
                </Show>
                {local.content}
              </Content>
            </Positioner>
          }
        >
          <Portal mount={local.portalRef}>
            <Positioner>
              <Content {...local.contentProps}>
                <Show when={local.showArrow}>
                  <Arrow>
                    <ArrowTip />
                  </Arrow>
                </Show>
                {local.content}
              </Content>
            </Positioner>
          </Portal>
        </Show>
      </Root>
    </Show>
  )
}
