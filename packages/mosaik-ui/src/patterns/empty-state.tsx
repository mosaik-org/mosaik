import { type JSX, mergeProps, Show } from "solid-js"
import { createSlotRecipeContext } from "../../styled-system/jsx"
import { emptyState } from "../../styled-system/recipes"
import { Button } from "../components/button"
import { RefreshCwIcon, TriangleAlertIcon } from "../components/icons"

const { withProvider, withContext } = createSlotRecipeContext(emptyState)
const Root = withProvider("div", "root")
const Icon = withContext("div", "icon")
const Content = withContext("div", "content")
const Title = withContext("p", "title")
const Description = withContext("p", "description")
const Action = withContext("div", "action")

export interface EmptyStateProps {
  readonly icon?: JSX.Element
  readonly title: JSX.Element
  readonly description?: JSX.Element
  /** What to do about it, such as a button that creates the first item. */
  readonly action?: JSX.Element
}

/** Instead of an empty list or page: what is missing and what to do about it. */
export const EmptyState = (props: EmptyStateProps) => (
  <Root>
    <Show when={props.icon}>
      <Icon aria-hidden="true">{props.icon}</Icon>
    </Show>
    <Content>
      <Title>{props.title}</Title>
      <Show when={props.description}>
        <Description>{props.description}</Description>
      </Show>
    </Content>
    <Show when={props.action}>
      <Action>{props.action}</Action>
    </Show>
  </Root>
)

export interface ErrorStateProps {
  /** "Something went wrong" by default. */
  readonly title?: string
  /** What went wrong, for people to read. */
  readonly message: string
  /** Shows a button that tries again. */
  readonly onRetry?: () => void
  readonly retryLabel?: string
}

/** Instead of what failed to load: the error, and a way to try again. */
export const ErrorState = (props: ErrorStateProps) => {
  const merged = mergeProps({ title: "Something went wrong", retryLabel: "Try again" }, props)
  return (
    <Root tone="danger" role="alert">
      <Icon aria-hidden="true">
        <TriangleAlertIcon />
      </Icon>
      <Content>
        <Title>{merged.title}</Title>
        <Description>{merged.message}</Description>
      </Content>
      <Show when={merged.onRetry}>
        <Action>
          <Button variant="outline" colorPalette="gray" size="sm" onClick={() => merged.onRetry?.()}>
            <RefreshCwIcon />
            {merged.retryLabel}
          </Button>
        </Action>
      </Show>
    </Root>
  )
}
