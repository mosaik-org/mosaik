import { SegmentGroup } from "@mosaik/mosaik-ui"
import Grid2X2Icon from "lucide-solid/icons/grid-2x2"
import ListIcon from "lucide-solid/icons/list"
import TableIcon from "lucide-solid/icons/table"
import { HStack } from "styled-system/jsx"

export const App = () => {
  return (
    <SegmentGroup.Root defaultValue="table">
      <SegmentGroup.Indicator />
      <SegmentGroup.Items
        items={[
          {
            value: "table",
            label: (
              <HStack>
                <TableIcon />
                Table
              </HStack>
            ),
          },
          {
            value: "board",
            label: (
              <HStack>
                <Grid2X2Icon />
                Board
              </HStack>
            ),
          },
          {
            value: "list",
            label: (
              <HStack>
                <ListIcon />
                List
              </HStack>
            ),
          },
        ]}
      />
    </SegmentGroup.Root>
  )
}
