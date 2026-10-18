import { type JSX, mergeProps } from "solid-js"
import { Button } from "./button"
import { Dialog } from "./dialog"

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: JSX.Element
  description?: JSX.Element
  confirmLabel?: string
  tone?: "accent" | "danger"
  loading?: boolean
  onConfirm: () => void
  children?: JSX.Element
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const merged = mergeProps({ confirmLabel: "Confirm", tone: "accent" as const }, props)

  return (
    <Dialog
      open={merged.open}
      onOpenChange={merged.onOpenChange}
      title={merged.title}
      description={merged.description}
      size="sm"
      footer={
        <>
          <Button variant="outline" disabled={merged.loading} onClick={() => merged.onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={merged.tone === "danger" ? "danger" : "solid"}
            loading={merged.loading}
            onClick={() => merged.onConfirm()}
          >
            {merged.confirmLabel}
          </Button>
        </>
      }
    >
      {merged.children}
    </Dialog>
  )
}
