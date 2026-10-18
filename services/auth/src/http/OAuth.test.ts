import { describe, expect, it } from "@effect/vitest"
import { isUnder } from "./OAuth"

describe("isUnder", () => {
  it("accepts the app's address and paths below it", () => {
    expect(isUnder("https://notes.example.com/auth/callback", "https://notes.example.com")).toBe(true)
    expect(isUnder("https://example.com/notes/auth/callback", "https://example.com/notes")).toBe(true)
    expect(isUnder("https://example.com/notes", "https://example.com/notes/")).toBe(true)
  })

  it("refuses other origins, sibling paths and credentials in the URL", () => {
    expect(isUnder("https://notes.example.com.evil.dev/cb", "https://notes.example.com")).toBe(false)
    expect(isUnder("http://notes.example.com/cb", "https://notes.example.com")).toBe(false)
    expect(isUnder("https://notes.example.com:8443/cb", "https://notes.example.com")).toBe(false)
    expect(isUnder("https://example.com/notes-evil/cb", "https://example.com/notes")).toBe(false)
    expect(isUnder("https://evil@notes.example.com/cb", "https://notes.example.com")).toBe(false)
    expect(isUnder("not a url", "https://notes.example.com")).toBe(false)
  })
})
