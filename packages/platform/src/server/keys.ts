import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { Redacted } from "effect"

/**
 * App keys look like `dak_<appId>.<secret>`, so the platform knows which app a key
 * claims to be before checking it.
 *
 * - Configured apps (named in `CONFIGURED_APPS`: built-in apps, `bun dev`'s examples,
 *   standalone apps) derive their key from `INTERNAL_KEY`.
 * - Apps the Portal installs get a random key; the platform stores only its hash.
 */
const PREFIX = "dak_"

export const parseAppKey = (key: string): { readonly appId: string; readonly secret: string } | undefined => {
  if (!key.startsWith(PREFIX)) return undefined
  const dot = key.indexOf(".", PREFIX.length)
  if (dot === -1) return undefined
  const appId = key.slice(PREFIX.length, dot)
  const secret = key.slice(dot + 1)
  return /^[a-z][a-z0-9-]*$/.test(appId) && secret.length > 0 ? { appId, secret } : undefined
}

export const derivedAppKey = (internalKey: Redacted.Redacted<string>, appId: string): Redacted.Redacted<string> =>
  Redacted.make(
    `${PREFIX}${appId}.${createHmac("sha256", Redacted.value(internalKey)).update(`mosaik-app:${appId}`).digest("base64url")}`,
  )

/** A new random key for a remote app, and the hash to store. */
export const generateAppKey = (appId: string) => {
  const key = `${PREFIX}${appId}.${randomBytes(32).toString("base64url")}`
  return { key: Redacted.make(key), hash: hashAppKey(key) }
}

export const hashAppKey = (key: string): string => createHash("sha256").update(key).digest("hex")

export const sameSecret = (a: string, b: string): boolean => {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
