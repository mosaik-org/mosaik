import { defineSlotRecipe } from "@pandacss/dev"

export const table = defineSlotRecipe({
  className: "table",
  slots: ["root", "body", "cell", "foot", "head", "header", "row", "caption"],
  base: {
    root: {
      borderCollapse: "collapse",
      fontVariantNumeric: "lining-nums tabular-nums",
      textAlign: "start",
      verticalAlign: "top",
      width: "full",
    },
    cell: {
      alignItems: "center",
      color: "fg.muted",
      textAlign: "start",
      textOverflow: "ellipsis",
      textStyle: "sm",
      whiteSpace: "nowrap",
      overflow: "hidden",
      boxShadow: "inset 0 -1px 0 0 var(--shadow-color)",
      shadowColor: "border",
      _pinned: {
        bg: "inherit",
        boxShadow: "inset 0 -1px 0 0 var(--shadow-color)",
        overflow: "unset",
        position: "sticky",
        shadowColor: "border",
        zIndex: 1,
      },
    },
    row: {
      _last: { "& td": { boxShadow: "none" } },
    },
    header: {
      textAlign: "start",
      verticalAlign: "middle",
      boxShadow: "inset 0 -1px 0 0 var(--shadow-color)",
      // A step stronger than the rows' lines: the header reads as one.
      shadowColor: "gray.a4",
      _pinned: {
        position: "sticky",
        bg: "inherit",
        zIndex: 2,
      },
    },
    head: {
      color: "fg.muted",
      fontWeight: "medium",
      textAlign: "start",
      whiteSpace: "nowrap",
      textStyle: "xs",
    },
    caption: {
      color: "fg.subtle",
      fontWeight: "medium",
    },
    foot: {
      fontWeight: "medium",
      "& td": { boxShadow: "inset 0 1px 0 0 var(--shadow-color)!", shadowColor: "border" },
    },
  },
  defaultVariants: {
    size: "md",
    variant: "plain",
    // Rows told apart by the pointer rather than by heavier lines.
    interactive: true,
  },
  variants: {
    variant: {
      surface: {
        header: { bg: "gray.surface.bg.hover" },
        row: { bg: "gray.surface.bg", _selected: { bg: "accent.subtle.bg" } },
      },
      // `_selected` in each variant: a variant's `bg` would beat one in the base.
      plain: {
        row: { _selected: { bg: "accent.subtle.bg" } },
      },
    },
    striped: {
      true: {
        row: { "&:nth-of-type(odd):not([data-selected]) td": { bg: "gray.surface.bg.hover" } },
      },
    },
    interactive: {
      true: {
        // A tint, not a surface step: it shows on white cards and dark ones alike.
        body: { "& tr": { _hover: { bg: "gray.subtle.bg", _selected: { bg: "accent.subtle.bg.hover" } } } },
      },
    },
    columnBorder: {
      true: {
        header: { "&:not(:last-of-type)": { borderInlineEndWidth: "1px" } },
        cell: { "&:not(:last-of-type)": { borderInlineEndWidth: "1px" } },
      },
    },
    stickyHeader: {
      true: {
        head: {
          "& :where(tr)": {
            top: "var(--table-sticky-offset, 0)",
            position: "sticky",
            zIndex: 2,
          },
        },
      },
    },
    // Rows of 32, 40 and 48, as controls of the same sizes.
    size: {
      sm: {
        root: { textStyle: "sm" },
        header: { px: "2.5", py: "1.5" },
        cell: { px: "2.5", py: "1.5" },
      },
      md: {
        root: { textStyle: "sm" },
        header: { px: "3", py: "2.5" },
        cell: { px: "3", py: "2.5" },
      },
      lg: {
        root: { textStyle: "md" },
        head: { textStyle: "sm" },
        header: { px: "4", py: "3" },
        cell: { px: "4", py: "3", textStyle: "md" },
      },
    },
  },
})
