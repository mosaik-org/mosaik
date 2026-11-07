import { describe, expect, it } from "vitest"
import { isChunkLoadError, withTimeout } from "./loading"

describe("withTimeout", () => {
  it("passes through a promise that settles in time", async () => {
    await expect(withTimeout(Promise.resolve(1), 50, "slow")).resolves.toBe(1)
    await expect(withTimeout(Promise.reject(new Error("boom")), 50, "slow")).rejects.toThrow("boom")
  })

  it("rejects when the promise takes too long", async () => {
    await expect(withTimeout(new Promise(() => {}), 10, "too slow")).rejects.toThrow("too slow")
  })
})

describe("isChunkLoadError", () => {
  it("recognises each browser's message", () => {
    for (const message of [
      "Failed to fetch dynamically imported module: http://localhost/apps/crm/chunks/home-abc.js",
      "error loading dynamically imported module: http://localhost/apps/crm/chunks/home-abc.js",
      "Importing a module script failed.",
      "Unable to preload CSS for /apps/crm/assets/home-abc.css",
    ]) {
      expect(isChunkLoadError(new TypeError(message))).toBe(true)
    }
  })

  it("ignores other errors", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false)
    expect(isChunkLoadError("Failed to fetch dynamically imported module")).toBe(false)
  })
})
