import { HttpServerResponse } from "effect/http"

/** A JSON answer of an OAuth endpoint: never cached (RFC 6749 §5.1). */
export const oauthJson = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  HttpServerResponse.jsonUnsafe(body, { status, headers: { "cache-control": "no-store", ...headers } })

/** An OAuth error (RFC 6749 §5.2). */
export const oauthError = (error: string, description: string, status = 400, headers: Record<string, string> = {}) =>
  oauthJson({ error, error_description: description }, status, headers)
