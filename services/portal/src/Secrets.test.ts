import { describe, expect, it } from "@effect/vitest"
import { Redacted } from "effect"
import { makeCipher } from "./Secrets"

describe("makeCipher", () => {
  it("round-trips, uses a fresh IV and rejects other keys", () => {
    const cipher = makeCipher(Redacted.make("internal-key"))
    const once = cipher.encrypt("postgres://user:pass@db/app")
    expect(once).toMatch(/^v1:/)
    expect(once).not.toContain("pass@db")
    expect(cipher.encrypt("postgres://user:pass@db/app")).not.toBe(once)
    expect(cipher.decrypt(once)).toBe("postgres://user:pass@db/app")
    expect(() => makeCipher(Redacted.make("other-key")).decrypt(once)).toThrow()
  })
})
