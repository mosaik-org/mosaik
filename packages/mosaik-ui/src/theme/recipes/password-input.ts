import { passwordInputAnatomy } from "@ark-ui/solid/anatomy"
import { defineSlotRecipe } from "@pandacss/dev"

/** The input itself uses the `input` recipe (sizes, variants); this places the visibility toggle in it. */
export const passwordInput = defineSlotRecipe({
  className: "password-input",
  slots: passwordInputAnatomy.keys(),
  base: {
    root: { display: "flex", flexDirection: "column", gap: "1.5", width: "full" },
    label: { textStyle: "label", color: "fg.default", userSelect: "none" },
    control: {
      position: "relative",
      display: "flex",
      alignItems: "center",
      width: "full",
      "& input": { paddingInlineEnd: "var(--input-height)" },
    },
    visibilityTrigger: {
      position: "absolute",
      insetInlineEnd: "0",
      top: "0",
      height: "full",
      aspectRatio: "square",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "l2",
      color: "fg.muted",
      cursor: "pointer",
      focusVisibleRing: "inside",
      _hover: { color: "fg.default" },
      _disabled: { layerStyle: "disabled" },
      _icon: { boxSize: "4" },
    },
    indicator: { display: "contents" },
  },
})
