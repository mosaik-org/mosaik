import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto"
import { Context, Effect, Layer, Redacted } from "effect"
import { PortalConfig } from "./PortalConfig"

const VERSION = "v1"

/** AES-256-GCM with a key derived from `secret`. Values look like `v1:<iv>:<tag>:<ciphertext>`. */
export const makeCipher = (secret: Redacted.Redacted<string>) => {
  const key = Buffer.from(hkdfSync("sha256", Redacted.value(secret), "mosaik-portal", "secrets", 32))
  return {
    encrypt: (plain: string): string => {
      const iv = randomBytes(12)
      const cipher = createCipheriv("aes-256-gcm", key, iv)
      const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
      return [
        VERSION,
        iv.toString("base64url"),
        cipher.getAuthTag().toString("base64url"),
        data.toString("base64url"),
      ].join(":")
    },
    decrypt: (stored: string): string => {
      const [version, iv, tag, data] = stored.split(":")
      if (version !== VERSION || iv === undefined || tag === undefined || data === undefined) {
        throw new Error("Unknown secret format")
      }
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"))
      decipher.setAuthTag(Buffer.from(tag, "base64url"))
      return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8")
    },
  }
}

/**
 * Encrypts what the Portal must be able to read back: config secrets, image apps' keys
 * and registry passwords. The key is derived from `INTERNAL_KEY`, so rotating that key
 * means entering those secrets again.
 */
export class Secrets extends Context.Service<Secrets, ReturnType<typeof makeCipher>>()(
  "@mosaik/portal-service/Secrets",
) {
  static readonly layer = Layer.effect(
    Secrets,
    Effect.gen(function* () {
      const config = yield* PortalConfig
      return Secrets.of(makeCipher(config.internalKey))
    }),
  )
}
