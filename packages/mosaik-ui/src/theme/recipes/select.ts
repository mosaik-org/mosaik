import { selectAnatomy } from "@ark-ui/solid/anatomy"
import { defineSlotRecipe } from "@pandacss/dev"
import { FIELD_HOVER } from "./input"

export const select = defineSlotRecipe({
  className: "select",
  slots: selectAnatomy.extendWith("indicatorGroup").keys(),
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      gap: "1.5",
      width: "full",
    },
    content: {
      // As a menu: floating over the page, a little of it showing through, blurred.
      background: "gray.surface.bg/90",
      backdropFilter: "blur(16px) saturate(1.5)",
      borderRadius: "l3",
      boxShadow: "md",
      display: "flex",
      flexDirection: "column",
      maxH: "min(var(--available-height), {sizes.96})",
      minWidth: "max(var(--reference-width), {sizes.40})",
      outline: 0,
      overflowY: "auto",
      // Above dialogs (`modal`), which they open in too, as `popover`, the layer for what floats.
      // Positioned, or its z-index is ignored and it stays under the dialog it opened in.
      position: "relative",
      zIndex: "calc({zIndex.popover} + var(--layer-index, 0))",
      _open: {
        animationStyle: "slide-fade-in",
        animationDuration: "fast",
      },
      _closed: {
        animationStyle: "slide-fade-out",
        animationDuration: "faster",
      },
    },
    item: {
      alignItems: "center",
      borderRadius: "l1",
      cursor: "pointer",
      display: "flex",
      justifyContent: "space-between",
      userSelect: "none",
      // The pointer highlights a row too, so one row is marked even as the keyboard moves on.
      _highlighted: {
        background: "gray.surface.bg.hover",
      },
      _disabled: {
        layerStyle: "disabled",
      },
    },
    indicatorGroup: {
      display: "flex",
      alignItems: "center",
      gap: "1",
      pointerEvents: "none",
    },
    control: {
      position: "relative",
    },
    // Beside the trigger, not inside it (a button cannot hold a button), just before its chevron.
    clearTrigger: {
      position: "absolute",
      top: "50%",
      transform: "translateY(-50%)",
      insetInlineEnd: "8",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "l1",
      color: "fg.muted",
      cursor: "pointer",
      focusVisibleRing: "outside",
      _hover: { color: "fg.default" },
      _icon: { boxSize: "3.5" },
    },
    indicator: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: { base: "fg.subtle", _invalid: "error" },
    },
    itemGroupLabel: {
      alignItems: "flex-start",
      color: "fg.subtle",
      display: "flex",
      flexDirection: "column",
      fontWeight: "medium",
      gap: "1px",
      justifyContent: "center",
      _after: {
        content: '""',
        width: "100%",
        height: "1px",
        bg: "gray.4",
      },
    },
    itemIndicator: {
      color: "colorPalette.plain.fg",
    },
    label: {
      fontWeight: "medium",
      userSelect: "none",
      textStyle: "sm",
    },
    trigger: {
      alignItems: "center",
      borderRadius: "l2",
      cursor: "pointer",
      display: "flex",
      justifyContent: "space-between",
      minWidth: "0",
      outline: "0",
      textAlign: "start",
      transition: "common",
      userSelect: "none",
      width: "full",
      _placeholderShown: {
        color: "fg.subtle",
      },
      _disabled: {
        layerStyle: "disabled",
      },
    },
    valueText: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
  defaultVariants: {
    size: "md",
    variant: "outline",
  },
  variants: {
    variant: {
      outline: {
        trigger: {
          borderWidth: "1px",
          borderColor: "gray.outline.border",
          [FIELD_HOVER]: { borderColor: "gray.surface.border.hover" },
          "&[aria-expanded=true]:not([data-invalid])": { borderColor: "gray.surface.border.hover" },
          focusVisibleRing: "inside",
          _invalid: {
            borderColor: "error",
            focusRingColor: "error",
          },
        },
      },
      surface: {
        trigger: {
          bg: "gray.surface.bg",
          borderWidth: "1px",
          borderColor: "gray.surface.border",
          [FIELD_HOVER]: { borderColor: "gray.surface.border.hover" },
          "&[aria-expanded=true]:not([data-invalid])": { borderColor: "gray.surface.border.hover" },
          focusVisibleRing: "inside",
          _invalid: {
            borderColor: "error",
            focusRingColor: "error",
          },
        },
      },
      subtle: {
        trigger: {
          borderWidth: "1px",
          borderColor: "transparent",
          bg: "gray.subtle.bg",
          color: "gray.subtle.fg",
          _hover: { bg: "gray.subtle.bg.hover" },
          _expanded: { bg: "gray.subtle.bg.hover" },
          focusVisibleRing: "inside",
          _invalid: {
            borderColor: "error",
            focusRingColor: "error",
          },
        },
      },
      // Only a label and a chevron until it is used: for toolbars, where a border is one too many.
      ghost: {
        trigger: {
          borderWidth: "1px",
          borderColor: "transparent",
          _hover: { bg: "gray.subtle.bg" },
          _expanded: { bg: "gray.subtle.bg" },
          focusVisibleRing: "inside",
          _invalid: {
            borderColor: "error",
            focusRingColor: "error",
          },
        },
      },
    },
    size: {
      xs: {
        content: { p: "1", gap: "0.5", textStyle: "sm" },
        item: { px: "1", minH: "6", gap: "2", _icon: { boxSize: "3.5" } },
        itemGroup: { gap: "0.5" },
        itemGroupLabel: { px: "1", height: "6" },
        trigger: { px: "2", h: "6", textStyle: "xs", gap: "2", _icon: { boxSize: "3.5" } },
      },
      sm: {
        content: { p: "1", gap: "0.5", textStyle: "sm" },
        item: { px: "1.5", minH: "7", gap: "2", _icon: { boxSize: "4" } },
        itemGroup: { gap: "0.5" },
        itemGroupLabel: { px: "1.5", height: "7" },
        trigger: { px: "2.5", h: "7", textStyle: "sm", gap: "2", _icon: { boxSize: "4" } },
      },
      md: {
        content: { p: "1", gap: "0.5", textStyle: "sm" },
        item: { px: "2", minH: "8", gap: "2", _icon: { boxSize: "4" } },
        itemGroup: { gap: "0.5" },
        itemGroupLabel: { px: "2", height: "8" },
        trigger: { px: "2.5", h: "8", textStyle: "sm", gap: "2", _icon: { boxSize: "4" } },
      },
      lg: {
        content: { p: "1", gap: "0.5", textStyle: "md" },
        item: { px: "2.5", minH: "10", gap: "2", _icon: { boxSize: "4.5" } },
        itemGroup: { gap: "0.5" },
        itemGroupLabel: { px: "2.5", height: "10" },
        trigger: { px: "3.5", h: "10", textStyle: "md", gap: "2", _icon: { boxSize: "4.5" } },
      },
      xl: {
        content: { p: "1", gap: "1", textStyle: "lg" },
        item: { px: "3", minH: "12", gap: "3", _icon: { boxSize: "5" } },
        itemGroup: { gap: "1" },
        itemGroupLabel: { px: "3", height: "12" },
        trigger: { px: "4", h: "12", textStyle: "lg", gap: "3", _icon: { boxSize: "5" } },
      },
    },
  },
})
