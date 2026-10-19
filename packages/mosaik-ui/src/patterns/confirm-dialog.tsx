import { type JSX, mergeProps } from "solid-js"
import { Button } from "../components/button"
import { Modal } from "./modal"

export interface ConfirmDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: JSX.Element
  readonly description?: JSX.Element
  /** "Confirm" by default; better the action itself: "Delete", "Refund". */
  readonly confirmLabel?: string
  readonly cancelLabel?: string
  /** `danger` for what cannot be undone. */
  readonly tone?: "accent" | "danger"
  /** While the action runs: the confirm button spins and Cancel is disabled. */
  readonly loading?: boolean
  readonly onConfirm: () => void
  /** More content, such as a reason to fill in. */
  readonly children?: JSX.Element
}

/** Asks before an action: `<ConfirmDialog title="Delete this user?" tone="danger" onConfirm={...} />`. */
export const ConfirmDialog = (props: ConfirmDialogProps) => {
  const merged = mergeProps({ confirmLabel: "Confirm", cancelLabel: "Cancel", tone: "accent" as const }, props)
  return (
    <Modal
      open={merged.open}
      onOpenChange={merged.onOpenChange}
      title={merged.title}
      description={merged.description}
      size="sm"
      footer={
        <>
          <Button
            variant="outline"
            colorPalette="gray"
            disabled={merged.loading}
            onClick={() => merged.onOpenChange(false)}
          >
            {merged.cancelLabel}
          </Button>
          <Button colorPalette={merged.tone} loading={merged.loading} onClick={() => merged.onConfirm()}>
            {merged.confirmLabel}
          </Button>
        </>
      }
    >
      {merged.children}
    </Modal>
  )
}
