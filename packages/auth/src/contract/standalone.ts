/**
 * What a standalone app's backend serves for its page (see `runApp` with `MOSAIK_PUBLIC_URL`):
 * signing in and out through Core, and the way to Core's pages for people. The page links
 * here, on its own address; the backend knows where Core is.
 */
export const STANDALONE_PATHS = {
  signIn: "/auth/sign-in",
  callback: "/auth/callback",
  /** POST. */
  signOut: "/auth/sign-out",
  /** To Core's page for asking for access to this app, and back. */
  requestAccess: "/auth/request-access",
  /** To Core's page for choosing which notifications someone gets. */
  notificationSettings: "/auth/notification-settings",
  /** Who is signed in (a `SessionInfo`), as behind the gateway. */
  session: "/api/auth/identity/session",
} as const

const withReturn = (path: string, returnTo: string | undefined) =>
  returnTo === undefined ? path : `${path}?${new URLSearchParams({ return: returnTo })}`

/**
 * Links for a standalone app's page. `returnTo` is a path on the app to come back to (its
 * home page when left out).
 *
 * @example
 * <a href={standaloneLinks.requestAccess(location.pathname)}>Request access</a>
 * <form method="post" action={standaloneLinks.signOut}><button>Sign out</button></form>
 */
export const standaloneLinks = {
  signIn: (returnTo?: string): string => withReturn(STANDALONE_PATHS.signIn, returnTo),
  requestAccess: (returnTo?: string): string => withReturn(STANDALONE_PATHS.requestAccess, returnTo),
  notificationSettings: STANDALONE_PATHS.notificationSettings,
  signOut: STANDALONE_PATHS.signOut,
} as const
