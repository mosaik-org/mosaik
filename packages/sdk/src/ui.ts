/**
 * `@mosaik/sdk/ui`: Mosaik's own components (people, query states, toasts). The components themselves
 * are `@mosaik/mosaik-ui`, which apps import directly; `@mosaik/sdk/ui/styles.css` styles both on a
 * standalone page (mounted apps have the shell's stylesheet).
 */
export {
  Freshness,
  type FreshnessProps,
  type FreshnessQuery,
  QueryBoundary,
  type QueryBoundaryProps,
  QueryFreshness,
  type QueryState,
  Toasts,
  UserAvatar,
  type UserAvatarProps,
} from "@mosaik/web-kit"
