import { listboxAnatomy } from "@ark-ui/solid/anatomy"
import { defineSlotRecipe } from "@pandacss/dev"

export const listbox = defineSlotRecipe({
  className: "listbox",
  slots: listboxAnatomy.keys(),
  base: {},
})
