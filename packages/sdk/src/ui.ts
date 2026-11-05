/**
 * `@mosaik/sdk/ui`: Mosaik's own components (the app icons, query states). The components themselves
 * are `@mosaik/mosaik-ui`, which apps import directly; `@mosaik/sdk/ui/styles.css` styles both on a
 * standalone page (mounted apps have the shell's stylesheet).
 */
export {
  AppIcon,
  type AppIconName,
  type AppIconProps,
  AppTile,
  appColor,
  appColorClass,
  appIconNames,
  Freshness,
  type FreshnessProps,
  type FreshnessQuery,
  QueryBoundary,
  type QueryBoundaryProps,
  QueryFreshness,
  type QueryState,
} from "@mosaik/web-kit"
