import { defineRecipe } from "@pandacss/dev"

export const skeleton = defineRecipe({
  className: "skeleton",
  jsx: ["Skeleton", "SkeletonCircle", "SkeletonText"],
  base: {},
  variants: {
    loading: {
      true: {
        borderRadius: "l2",
        boxShadow: "none",
        backgroundClip: "padding-box",
        cursor: "default",
        color: "transparent",
        pointerEvents: "none",
        userSelect: "none",
        flexShrink: "0",
        "&::before, &::after, *": {
          visibility: "hidden",
        },
      },
      false: {
        background: "unset",
        animation: "fade-in var(--fade-duration, 0.1s) ease-out !important",
      },
    },

    circle: {
      true: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
        borderRadius: "9999px",
      },
    },

    variant: {
      pulse: {
        background: "gray.subtle.bg.active",
        animation: "pulse",
        animationDuration: "var(--duration, 1.2s)",
      },
      // A highlight sweeping across, as content on its way; a gentle pulse where motion is reduced.
      shine: {
        "--animate-from": "150%",
        "--animate-to": "-50%",
        "--shine-color": { base: "colors.white.a10", _dark: "colors.white.a2" },
        backgroundColor: "gray.subtle.bg.hover",
        backgroundImage: "linear-gradient(90deg, transparent 30%, var(--shine-color) 50%, transparent 70%)",
        backgroundSize: "200% 100%",
        backgroundRepeat: "no-repeat",
        animation: "bg-position var(--duration, 1.6s) ease-in-out infinite",
        _motionReduce: {
          backgroundImage: "none",
          animation: "pulse",
        },
      },
      none: {
        animation: "none",
      },
    },
  },

  defaultVariants: {
    variant: "shine",
    loading: true,
  },
})
