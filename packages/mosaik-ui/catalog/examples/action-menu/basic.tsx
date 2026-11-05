import { ActionMenu, IconButton } from "@mosaik/mosaik-ui"
import EllipsisIcon from "lucide-solid/icons/ellipsis"
import PencilIcon from "lucide-solid/icons/pencil"
import TrashIcon from "lucide-solid/icons/trash"

export const App = () => (
  <ActionMenu
    trigger={(trigger) => (
      <IconButton variant="plain" aria-label="Actions for Ada Lovelace" {...trigger()}>
        <EllipsisIcon />
      </IconButton>
    )}
    header="Ada Lovelace"
    items={[
      { value: "edit", label: "Edit roles", icon: <PencilIcon />, onSelect: () => {} },
      { value: "delete", label: "Delete", icon: <TrashIcon />, danger: true, onSelect: () => {} },
    ]}
  />
)
