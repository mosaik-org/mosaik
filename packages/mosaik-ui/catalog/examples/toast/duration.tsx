import { Button, toaster } from "@mosaik/mosaik-ui"

export const App = () => {
  return (
    <div>
      <Button
        variant="outline"
        onClick={() =>
          toaster.create({
            title: "Title",
            description: "Description",
            duration: 6000,
          })
        }
      >
        Add Toast
      </Button>
    </div>
  )
}
