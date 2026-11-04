import { fileUploadAnatomy } from "@ark-ui/solid/anatomy"
import { defineSlotRecipe } from "@pandacss/dev"

export const fileUpload = defineSlotRecipe({
  className: "file-upload",
  slots: fileUploadAnatomy.keys(),
  base: {
    root: {
      // Focus and a file dragged over in the accent, as the focus ring.
      colorPalette: "accent",
      alignItems: "flex-start",
      display: "flex",
      flexDirection: "column",
      gap: "1.5",
      width: "full",
    },
    label: {
      textStyle: "label",
    },
    dropzone: {
      alignItems: "center",
      background: "gray.surface.bg",
      borderRadius: "l3",
      borderStyle: "dashed",
      borderWidth: "2px",
      display: "flex",
      flexDirection: "column",

      focusVisibleRing: "outside",
      justifyContent: "center",
      transition: "backgrounds",
      width: "full",
      _dragging: {
        background: "gray.surface.bg.hover",
        borderStyle: "solid",
        borderColor: "colorPalette.solid.bg",
      },
    },
    item: {
      alignItems: "start",
      animationDuration: "normal",
      animationName: "fade-in",
      background: "gray.surface.bg",
      borderRadius: "l3",
      borderWidth: "1px",
      display: "flex",
      pos: "relative",
      width: "full",
    },
    itemGroup: {
      display: "flex",
      alignItems: "start",
      flexDirection: "column",
      width: "full",
    },
    itemName: {
      color: "fg.default",
      fontWeight: "medium",
    },
    itemSizeText: {
      color: "fg.muted",
    },
    itemDeleteTrigger: {
      color: "fg.subtle",
    },
    itemPreviewImage: {
      aspectRatio: "1",
      objectFit: "cover",
      maxW: "20",
      borderRadius: "l2",
    },
  },
  defaultVariants: {
    size: "md",
  },
  variants: {
    size: {
      // A field in a form (`FileUploadField`): a drop area as tall as a few lines.
      sm: {
        root: { gap: "3" },
        dropzone: { px: "4", py: "3", minHeight: "32", gap: "1.5", textStyle: "sm" },
        item: { p: "3", gap: "2", textStyle: "sm" },
        itemGroup: { gap: "2" },
        itemDeleteTrigger: { _icon: { boxSize: "4" } },
      },
      md: {
        root: { gap: "4" },
        dropzone: { px: "6", py: "4", minHeight: "xs", gap: "0" },
        item: { p: "4", gap: "3", textStyle: "sm" },
        itemGroup: { gap: "3" },
        itemDeleteTrigger: { _icon: { boxSize: "4" } },
      },
    },
  },
})
