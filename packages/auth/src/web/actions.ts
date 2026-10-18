/**
 * Thin wrappers over Better Auth's REST endpoints (`/api/auth/*`, proxied by the gateway).
 * After any of these, call `queryClient.clear()` and refetch the session: grants change.
 */

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
  ) {
    super(message)
    this.name = "AuthError"
  }
}

const post = async <A>(path: string, body: Record<string, unknown>): Promise<A> => {
  const response = await fetch(`/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const payload: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    const { message, code } = (payload ?? {}) as { message?: string; code?: string }
    throw new AuthError(message ?? "Authentication failed", code)
  }
  return payload as A
}

export const signInWithPassword = (email: string, password: string): Promise<void> =>
  post("/sign-in/email", { email, password, rememberMe: true }).then(() => undefined)

/** Redirects to Microsoft Entra ID; the browser comes back to `callbackURL` after login. */
export const signInWithMicrosoft = async (callbackURL: string): Promise<void> => {
  const { url } = await post<{ url: string }>("/sign-in/social", {
    provider: "microsoft",
    callbackURL,
    errorCallbackURL: "/login?error=sso",
  })
  window.location.assign(url)
}

export const signOut = (): Promise<void> => post("/sign-out", {}).then(() => undefined)
