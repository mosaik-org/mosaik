import { signInUrl } from "../contract/sign-in"

/**
 * Sends the browser to Core's sign-in page, which comes back to `returnTo` (a path on this
 * origin) once signed in. The one way to sign in, for the shell and the console alike.
 */
export const signIn = (returnTo: string = `${location.pathname}${location.search}`): void => {
  location.assign(signInUrl(returnTo))
}

/** Ends the Core session (Better Auth's endpoint, proxied by the gateway). Then reload the session: grants change. */
export const signOut = async (): Promise<void> => {
  await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
}
