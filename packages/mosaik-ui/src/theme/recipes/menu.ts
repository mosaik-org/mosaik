import { menuAnatomy } from "@ark-ui/solid/anatomy"
import { defineSlotRecipe } from "@pandacss/dev"

export const menu = defineSlotRecipe({
  className: "menu",
  slots: menuAnatomy.extendWith("itemCommand").keys(),
  base: {
    content: {
      // Above dialogs (`modal`), which menus open in too: the `popover` layer, for what floats.
      "--menu-z-index": "zIndex.popover",

      // A little of the page shows through, blurred: the menu floats over it.
      bg: "gray.surface.bg/90",
      backdropFilter: "blur(16px) saturate(1.5)",
      borderRadius: "l3",
      boxShadow: "md",
      display: "flex",
      flexDirection: "column",
      maxH: "min(var(--available-height), {sizes.96})",
      minWidth: "max(var(--reference-width), {sizes.40})",
      outline: "0",
      overflow: "hidden",
      overflowY: "auto",
      position: "relative",
      zIndex: "calc(var(--menu-z-index) + var(--layer-index, 0))",
      _open: {
        animationStyle: "slide-fade-in",
        animationDuration: "fast",
      },
      _closed: {
        animationStyle: "slide-fade-out",
        animationDuration: "faster",
      },
    },
    arrow: {
      "--arrow-size": "sizes.2",
      "--arrow-background": "colors.gray.surface.bg",
    },
    // An edge, as `Popover`'s: on a surface of its own color it would not show.
    arrowTip: {
      borderTopWidth: "0.5px",
      borderInlineStartWidth: "0.5px",
    },
    item: {
      alignItems: "center",
      borderRadius: "l2",
      cursor: "pointer",
      display: "flex",
      flex: "0 0 auto",
      outline: "0",
      textAlign: "start",
      textDecoration: "none",
      userSelect: "none",
      width: "100%",
      _highlighted: {
        bg: "gray.surface.bg.hover",
      },
      _disabled: {
        layerStyle: "disabled",
      },
      // An item that destroys something (`data-danger`).
      "&[data-danger]": {
        color: "danger.plain.fg",
        _highlighted: { bg: "danger.subtle.bg" },
      },
    },
    trigger: {
      _focusVisible: {
        focusVisibleRing: "outside",
      },
    },
    // Pushed to the end of its row, past the label.
    itemCommand: {
      color: "fg.subtle",
      flexShrink: "0",
      ms: "auto",
      ps: "4",
      textStyle: "xs",
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
        bg: "border",
      },
    },
    itemIndicator: {
      justifyContent: "flex-end",
      display: "flex",
      flex: "1",
      _checked: {
        _icon: {
          color: "colorPalette.plain.fg",
        },
      },
    },
  },
  defaultVariants: {
    size: "md",
  },

  variants: {
    size: {
      xs: {
        content: { p: "1", gap: "0.5", textStyle: "sm" },
        item: { px: "1", minH: "6", gap: "2", _icon: { boxSize: "3.5" } },
        itemGroup: { gap: "0.5" },
        itemGroupLabel: { px: "1", height: "6" },
        separator: { mx: "-1", my: "0.5" },
      },
      sm: {
        content: { p: "1", gap: "0.5", textStyle: "sm" },
        item: { px: "1.5", minH: "7", gap: "2", _icon: { boxSize: "4" } },
        itemGroup: { gap: "0.5" },
        itemGroupLabel: { px: "1.5", height: "7" },
        separator: { mx: "-1.5", my: "0.5" },
      },
      md: {
        content: { p: "1", gap: "0.5", textStyle: "sm" },
        item: { px: "2", minH: "8", gap: "2", _icon: { boxSize: "4" } },
        itemGroup: { gap: "0.5" },
        itemGroupLabel: { px: "2", height: "8" },
        separator: { mx: "-2", my: "0.5" },
      },
      lg: {
        content: { p: "1", gap: "0.5", textStyle: "md" },
        item: { px: "2.5", minH: "10", gap: "2", _icon: { boxSize: "4.5" } },
        itemGroup: { gap: "0.5" },
        itemGroupLabel: { px: "2.5", height: "10" },
        separator: { mx: "-2.5", my: "0.5" },
      },
      xl: {
        content: { p: "1", gap: "1", textStyle: "lg" },
        item: { px: "3", minH: "12", gap: "3", _icon: { boxSize: "5" } },
        itemGroup: { gap: "1" },
        itemGroupLabel: { px: "3", height: "12" },
        separator: { mx: "-3", my: "0" },
      },
    },
  },
})
