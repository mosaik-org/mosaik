import { Clipboard, IconButton } from "@mosaik/mosaik-ui"

export const App = () => {
  return (
    <Clipboard.Root value="https://park-ui.com">
      <Clipboard.Trigger
        asChild={(triggerProps) => (
          <IconButton variant="surface" size="sm" {...triggerProps()}>
            <Clipboard.Indicator />
          </IconButton>
        )}
      />
    </Clipboard.Root>
  )
}
