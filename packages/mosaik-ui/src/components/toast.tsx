import { Toaster as ArkToaster, createToaster, Toast, useToastContext } from "@ark-ui/solid/toast"
import { Show } from "solid-js"
import { Portal } from "solid-js/web"
import { createSlotRecipeContext, Stack, styled } from "../../styled-system/jsx"
import { toast as toastRecipe } from "../../styled-system/recipes"
import { CloseButton } from "./close-button"
import { Icon, type IconProps } from "./icon"
import { CheckCircleIcon, CircleAlertIcon, CircleXIcon } from "./icons"
import { Spinner } from "./spinner"

const { withProvider, withContext } = createSlotRecipeContext(toastRecipe)

const Root = withProvider(Toast.Root, "root")
const Title = withContext(Toast.Title, "title")
const Description = withContext(Toast.Description, "description")
const ActionTrigger = withContext(Toast.ActionTrigger, "actionTrigger")
const CloseTrigger = withContext(Toast.CloseTrigger, "closeTrigger")
const StyledToaster = styled(ArkToaster)

const iconMap: Record<string, any> = {
  warning: CircleAlertIcon,
  success: CheckCircleIcon,
  error: CircleXIcon,
}

const Indicator = (props: IconProps) => {
  const toast = useToastContext()

  const StatusIcon = () => iconMap[toast().type]

  return (
    <Show when={StatusIcon()}>
      {(Icon_) => (
        <Icon data-type={toast().type} {...props}>
          <Icon_ />
        </Icon>
      )}
    </Show>
  )
}

export const toaster = createToaster({
  placement: "bottom-end",
  pauseOnPageIdle: true,
  overlap: true,
  max: 5,
})

export const Toaster = () => {
  return (
    <Portal>
      <StyledToaster toaster={toaster} insetInline={{ mdDown: "4" }}>
        {(toast) => (
          <Root>
            <Show when={toast().type === "loading"} fallback={<Indicator />}>
              <Spinner color="colorPalette.plain.fg" />
            </Show>

            <Stack gap="3" alignItems="start">
              <Stack gap="1">
                <Show when={toast().title}>
                  <Title>{toast().title}</Title>
                </Show>
                <Show when={toast().description}>
                  <Description>{toast().description}</Description>
                </Show>
              </Stack>
              <Show when={toast().action}>{(action) => <ActionTrigger>{action().label}</ActionTrigger>}</Show>
            </Stack>
            <Show when={toast().closable}>
              <CloseTrigger>
                <CloseButton size="sm" />
              </CloseTrigger>
            </Show>
          </Root>
        )}
      </StyledToaster>
    </Portal>
  )
}

/**
 * Shows a toast in the `Toaster`: `toast.success("Saved")`, `toast.error("Could not save", reason)`.
 * `toaster` takes everything else (actions, durations, promises).
 */
export const toast = {
  success: (title: string, description?: string) => toaster.create({ type: "success", title, description }),
  error: (title: string, description?: string) => toaster.create({ type: "error", title, description }),
  warning: (title: string, description?: string) => toaster.create({ type: "warning", title, description }),
  info: (title: string, description?: string) => toaster.create({ type: "info", title, description }),
}
