import { dialogAnatomy } from "@ark-ui/solid/anatomy"
import { defineSlotRecipe } from "@pandacss/dev"

export const drawer = defineSlotRecipe({
  className: "drawer",
  slots: dialogAnatomy.extendWith("header", "body", "footer").keys(),
  base: {
    backdrop: {
      background: "black.a7",
      // As a dialog's: the page behind, out of focus.
      backdropFilter: "blur(2px)",
      position: "fixed",
      insetInlineStart: "0",
      top: "0",
      width: "100vw",
      height: "100dvh",
      zIndex: "overlay",
      _open: {
        animationName: "fade-in",
        animationTimingFunction: "enter",
        animationDuration: "slower",
      },
      _closed: {
        animationName: "fade-out",
        animationTimingFunction: "exit",
        animationDuration: "normal",
      },
    },
    positioner: {
      display: "flex",
      width: "100vw",
      height: "100dvh",
      position: "fixed",
      insetInlineStart: "0",
      top: "0",
      zIndex: "modal",
      overscrollBehaviorY: "none",
    },
    content: {
      display: "flex",
      flexDirection: "column",
      position: "relative",
      width: "100%",
      outline: 0,
      zIndex: "modal",
      maxH: "100dvh",
      color: "inherit",
      textStyle: "sm",
      bg: "gray.surface.bg",
      boxShadow: "lg",
      _open: {
        animationDuration: "slower",
        animationTimingFunction: "enter",
      },
      _closed: {
        animationDuration: "normal",
        animationTimingFunction: "exit",
      },
    },
    header: {
      display: "flex",
      flexDirection: "column",
      gap: "1",
      pt: { base: "4", md: "6" },
      pb: "4",
      px: { base: "4", md: "6" },
      flex: "0",
    },
    body: {
      display: "flex",
      flexDirection: "column",
      flex: "1",
      overflow: "auto",
      p: { base: "4", md: "6" },
    },
    footer: {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      flex: "0",
      gap: "3",
      py: "4",
      px: { base: "4", md: "6" },
    },
    title: {
      color: "fg.default",
      fontWeight: "semibold",
      textStyle: "lg",
    },
    description: {
      color: "fg.muted",
      textStyle: "sm",
    },
    closeTrigger: {
      pos: "absolute",
      top: "3",
      insetEnd: "3",
    },
  },
  defaultVariants: {
    placement: "end",
    size: "sm",
  },
  variants: {
    size: {
      xs: {
        content: {
          maxW: "xs",
        },
      },
      sm: {
        content: {
          maxW: "sm",
        },
      },
      md: {
        content: {
          maxW: "md",
        },
      },
      lg: {
        content: {
          maxW: "lg",
        },
      },
      xl: {
        content: {
          maxW: "xl",
        },
      },
      full: {
        content: {
          maxW: "100vw",
          h: "100dvh",
        },
      },
    },
    placement: {
      start: {
        positioner: {
          justifyContent: "flex-start",
          alignItems: "stretch",
        },
        content: {
          _open: {
            animationName: {
              base: "slide-from-left-full, fade-in",
              _rtl: "slide-from-right-full, fade-in",
            },
          },
          _closed: {
            animationName: {
              base: "slide-to-left-full, fade-out",
              _rtl: "slide-to-right-full, fade-out",
            },
          },
        },
      },
      end: {
        positioner: {
          justifyContent: "flex-end",
          alignItems: "stretch",
        },
        content: {
          _open: {
            animationName: {
              base: "slide-from-right-full, fade-in",
              _rtl: "slide-from-left-full, fade-in",
            },
          },
          _closed: {
            animationName: {
              base: "slide-to-right-full, fade-out",
              _rtl: "slide-to-left-full, fade-out",
            },
          },
        },
      },
      top: {
        positioner: {
          justifyContent: "stretch",
          alignItems: "flex-start",
        },
        content: {
          maxW: "100%",
          _open: { animationName: "slide-from-top-full, fade-in" },
          _closed: { animationName: "slide-to-top-full, fade-out" },
        },
      },

      bottom: {
        positioner: {
          justifyContent: "stretch",
          alignItems: "flex-end",
        },
        content: {
          maxW: "100%",
          _open: { animationName: "slide-from-bottom-full, fade-in" },
          _closed: { animationName: "slide-to-bottom-full, fade-out" },
        },
      },
    },
  },
})
