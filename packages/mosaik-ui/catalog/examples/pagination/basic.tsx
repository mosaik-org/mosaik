import { ButtonGroup, IconButton, Pagination } from "@mosaik/mosaik-ui"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-solid"

export const App = () => {
  return (
    <Pagination.Root count={20} pageSize={2} defaultPage={1}>
      <ButtonGroup variant="outline" size="sm">
        <Pagination.PrevTrigger
          asChild={(triggerProps) => (
            <IconButton colorPalette="gray" {...triggerProps()}>
              <ChevronLeftIcon />
            </IconButton>
          )}
        />
        <Pagination.Items
          render={(page, item) =>
            page.selected ? (
              <IconButton variant="solid" {...item()}>
                {page.value}
              </IconButton>
            ) : (
              <IconButton variant="outline" colorPalette="gray" {...item()}>
                {page.value}
              </IconButton>
            )
          }
        />
        <Pagination.NextTrigger
          asChild={(triggerProps) => (
            <IconButton colorPalette="gray" {...triggerProps()}>
              <ChevronRightIcon />
            </IconButton>
          )}
        />
      </ButtonGroup>
    </Pagination.Root>
  )
}
