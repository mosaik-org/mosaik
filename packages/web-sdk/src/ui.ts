/**
 * `@mosaik/web-sdk/ui`: Mosaik's own components (people, query states, toasts, errors, the theme a person
 * chose). The components themselves are `@mosaik/ui`, which apps import directly;
 * `@mosaik/web-sdk/ui/styles.css` styles both on a standalone page (mounted apps have the shell's
 * stylesheet, and the shell's theme).
 */
export {
  ErrorState,
  type ErrorStateProps,
  Freshness,
  type FreshnessProps,
  type FreshnessQuery,
  QueryBoundary,
  type QueryBoundaryProps,
  QueryFreshness,
  type QueryState,
  type ResolvedTheme,
  THEME_STORAGE_KEY,
  type Theme,
  ThemeChoice,
  type ThemeContextValue,
  ThemeProvider,
  ThemeToggle,
  Toasts,
  UserAvatar,
  type UserAvatarProps,
  useTheme,
} from "@mosaik/web-kit"
