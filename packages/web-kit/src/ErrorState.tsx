import { AlertTriangleIcon, Button, EmptyState } from "@mosaik/ui"
import RefreshCw from "lucide-solid/icons/refresh-cw"
import { mergeProps, Show } from "solid-js"

export interface ErrorStateProps {
  /** "Something went wrong" by default. */
  readonly title?: string
  /** What went wrong, for people to read. */
  readonly message: string
  /** Shows a button that tries again. */
  readonly onRetry?: () => void
  readonly retryLabel?: string
}

/**
 * Instead of what failed to load: the error in words, and a way to try again. An empty state in the
 * danger color, announced as it appears, as the failure is news to someone waiting for the page.
 */
export const ErrorState = (props: ErrorStateProps) => {
  const merged = mergeProps({ title: "Something went wrong", retryLabel: "Try again" }, props)
  return (
    <EmptyState.Root role="alert">
      <EmptyState.Indicator bg="danger.subtle" color="danger.fg">
        <AlertTriangleIcon />
      </EmptyState.Indicator>
      <EmptyState.Content>
        <EmptyState.Title>{merged.title}</EmptyState.Title>
        <EmptyState.Description>{merged.message}</EmptyState.Description>
      </EmptyState.Content>
      <Show when={merged.onRetry}>
        <EmptyState.Actions>
          <Button variant="outline" size="sm" onClick={() => merged.onRetry?.()}>
            <RefreshCw />
            {merged.retryLabel}
          </Button>
        </EmptyState.Actions>
      </Show>
    </EmptyState.Root>
  )
}
