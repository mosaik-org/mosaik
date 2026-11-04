import { stepsAnatomy } from "@ark-ui/solid/anatomy"
import { defineSlotRecipe } from "@pandacss/dev"

/** A sequence of steps (a wizard): numbered indicators joined by separators that fill as steps complete. */
export const steps = defineSlotRecipe({
  className: "steps",
  slots: [...stepsAnatomy.keys(), "title", "description"],
  base: {
    root: {
      // Checked, chosen or filled in the accent: what the person set, or is doing.
      colorPalette: "accent",
      display: "flex",
      width: "full",
      gap: "6",
      _horizontal: { flexDirection: "column" },
      _vertical: { flexDirection: "row" },
    },
    list: {
      display: "flex",
      justifyContent: "space-between",
      _horizontal: { flexDirection: "row", alignItems: "center" },
      _vertical: { flexDirection: "column", alignItems: "flex-start", gap: "4" },
    },
    item: {
      position: "relative",
      display: "flex",
      gap: "3",
      flex: "1 0 0",
      "&:last-of-type": { flex: "initial" },
      _horizontal: { alignItems: "center" },
      _vertical: { alignItems: "flex-start", width: "full" },
    },
    trigger: {
      display: "flex",
      alignItems: "center",
      gap: "3",
      textAlign: "start",
      borderRadius: "l2",
      focusVisibleRing: "outside",
      _disabled: { cursor: "default" },
    },
    indicator: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: "0",
      borderRadius: "full",
      borderWidth: "2px",
      borderColor: "gray.outline.border",
      color: "fg.muted",
      fontWeight: "medium",
      boxSize: "var(--steps-size)",
      textStyle: "sm",
      _icon: { boxSize: "var(--steps-icon-size)" },
      _current: { borderColor: "colorPalette.solid.bg", color: "colorPalette.surface.fg" },
      _complete: { bg: "colorPalette.solid.bg", borderColor: "colorPalette.solid.bg", color: "colorPalette.solid.fg" },
    },
    title: { textStyle: "sm", fontWeight: "medium", color: "fg.default" },
    description: { textStyle: "sm", color: "fg.muted" },
    separator: {
      flex: "1",
      bg: "border",
      _complete: { bg: "colorPalette.solid.bg" },
      "[data-part=item]:last-of-type > &": { display: "none" },
      _horizontal: { height: "2px", marginInline: "3" },
      _vertical: {
        position: "absolute",
        width: "2px",
        insetInlineStart: "calc(var(--steps-size) / 2 - 1px)",
        top: "calc(var(--steps-size) + token(spacing.1))",
        height: "calc(100% - var(--steps-size) + token(spacing.2))",
      },
    },
    content: { flex: "1" },
    nextTrigger: {},
    prevTrigger: {},
    progress: {},
  },
  defaultVariants: { size: "md" },
  variants: {
    size: {
      sm: { root: { "--steps-size": "sizes.6", "--steps-icon-size": "sizes.3.5" } },
      md: { root: { "--steps-size": "sizes.8", "--steps-icon-size": "sizes.4" } },
      lg: { root: { "--steps-size": "sizes.10", "--steps-icon-size": "sizes.5" } },
    },
  },
})
