import { tabsAnatomy } from "@ark-ui/solid/anatomy"
import { defineSlotRecipe } from "@pandacss/dev"

export const tabs = defineSlotRecipe({
  slots: tabsAnatomy.keys(),
  className: "tabs",
  base: {
    root: {
      position: "relative",
      display: "flex",
      alignItems: "start",
      _horizontal: {
        flexDirection: "column",
        gap: "2",
      },
      _vertical: {
        flexDirection: "row",
        gap: "4",
      },
    },
    list: {
      display: "flex",
      position: "relative",
      isolation: "isolate",
      _horizontal: {
        flexDirection: "row",
        // More tabs than fit scroll sideways, within the row, and never widen the page.
        maxW: "full",
        overflowX: "auto",
        scrollbarWidth: "none",
      },
      _vertical: {
        flexDirection: "column",
      },
    },
    // The selected tab draws its own mark, in CSS. Measuring it for a sliding indicator happens only
    // once, as the tabs start: on a page still loading its data that found nothing, and no tab showed.
    trigger: {
      alignItems: "center",
      cursor: "pointer",
      display: "flex",
      // As wide as its label: in a tight row, the row overflows rather than labels running together.
      flexShrink: "0",
      whiteSpace: "nowrap",
      fontWeight: "medium",
      outline: "0",
      position: "relative",
      transition: "color 0.15s, background 0.15s",
      // Within the tab: a list that scrolls clips what reaches past it.
      "--focus-ring-offset": "-3px",
      _focusVisible: {
        focusVisibleRing: "outside",
      },
      _disabled: {
        layerStyle: "disabled",
      },
    },
    content: {
      focusVisibleRing: "inside",

      _horizontal: {
        width: "100%",
      },
      _vertical: {
        height: "100%",
      },
    },
  },

  variants: {
    size: {
      xs: {
        list: { gap: "1" },
        trigger: { h: "6", minW: "6", textStyle: "xs", px: "2.5", gap: "2" },
      },
      sm: {
        list: { gap: "1" },
        trigger: { h: "7", minW: "7", textStyle: "sm", px: "3", gap: "2" },
      },
      md: {
        list: { gap: "1" },
        trigger: { h: "8", minW: "8", textStyle: "sm", px: "3", gap: "2" },
      },
      lg: {
        list: { gap: "1" },
        trigger: { h: "10", minW: "10", textStyle: "md", px: "4.5", gap: "2" },
      },
    },
    variant: {
      line: {
        root: {
          alignItems: "stretch",
        },
        list: {
          // A line inside the list rather than a border: the list scrolls, which would clip the
          // selected tab's mark where it meets a border.
          _horizontal: {
            boxShadow: "inset 0 -1px 0 0 token(colors.border)",
          },
          _vertical: {
            borderStartWidth: "1px",
          },
        },
        trigger: {
          color: "fg.muted",
          _selected: {
            color: "colorPalette.plain.fg",
            _after: {
              content: '""',
              position: "absolute",
              bg: "colorPalette.solid.bg",
            },
          },
          _horizontal: {
            _selected: { _after: { insetX: "0", bottom: "0", height: "0.5" } },
          },
          _vertical: {
            _selected: { _after: { insetY: "0", left: "-1px", width: "0.5" } },
          },
        },
      },
      subtle: {
        trigger: {
          color: "fg.muted",
          borderRadius: "l2",
          _selected: {
            color: "colorPalette.subtle.fg",
            bg: "colorPalette.subtle.bg",
          },
        },
      },
      enclosed: {
        list: {
          bg: {
            base: "gray.2",
            _dark: "gray.1",
          },
          boxShadow: "inset 0 0 0px 1px var(--shadow-color)",
          boxShadowColor: "border",
          borderRadius: "l3",
          p: "1",
        },
        trigger: {
          color: "fg.muted",
          borderRadius: "l2",
          _selected: {
            color: "colorPalette.surface.fg",
            boxShadow: {
              base: "xs",
              _dark: "none",
            },
            bg: {
              base: "white",
              _dark: "gray.3",
            },
          },
        },
      },
    },
    fitted: {
      true: {
        root: {
          alignItems: "stretch",
        },
        trigger: {
          flex: 1,
          textAlign: "center",
          justifyContent: "center",
        },
      },
    },
  },

  defaultVariants: {
    size: "md",
    variant: "line",
  },
})
