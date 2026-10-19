import { Button, Clipboard } from "@mosaik/mosaik-ui"

export const App = () => {
  return (
    <Clipboard.Root value="https://park-ui.com">
      <Clipboard.Trigger
        asChild={(triggerProps) => (
          <Button variant="surface" size="sm" {...triggerProps()}>
            <Clipboard.Indicator />
            <Clipboard.CopyText />
          </Button>
        )}
      />
    </Clipboard.Root>
  )
}
