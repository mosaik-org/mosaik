/**
 * Core's sign-in page, the one way in: the shell, the console and standalone apps (through
 * OAuth) all send people here. `return` is a path on Core's origin to go back to.
 */
export const SIGN_IN_PATH = "/api/auth/sign-in"
/** Starts signing in with Microsoft (Entra ID) on the server, so the page needs no JavaScript. */
export const SIGN_IN_MICROSOFT_PATH = "/api/auth/sign-in/microsoft"

export const signInUrl = (returnTo: string): string => `${SIGN_IN_PATH}?${new URLSearchParams({ return: returnTo })}`
