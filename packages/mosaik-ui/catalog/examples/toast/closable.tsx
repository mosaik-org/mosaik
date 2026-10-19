import { Button, toaster } from "@mosaik/mosaik-ui"

export const App = () => {
  return (
    <Button
      variant="outline"
      onClick={() =>
        toaster.create({
          title: "Title",
          description: "Description",
          closable: true,
        })
      }
    >
      Add Toast
    </Button>
  )
}
