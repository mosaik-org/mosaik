import { describe, expect, it } from "@effect/vitest"
import { storageKeyProblem } from "@mosaik/platform/contract"
import { allowance, counted } from "./Storage"

const MB = 1024 * 1024

/** A body of `chunks` chunks of 1 MB, counting how many were read. */
const body = (chunks: number) => {
  let read = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (read === chunks) return controller.close()
      read++
      controller.enqueue(new Uint8Array(MB))
    },
  })
  return { stream, read: () => read }
}

const drain = async (stream: ReadableStream<Uint8Array>) => {
  let bytes = 0
  for await (const chunk of stream) bytes += chunk.byteLength
  return bytes
}

describe("allowance", () => {
  it("is the limit less what the app stores elsewhere", () => {
    expect(allowance(10 * MB, 4 * MB, 0)).toBe(6 * MB)
    // Replacing a 3 MB file: it counts for nothing.
    expect(allowance(10 * MB, 4 * MB, 3 * MB)).toBe(9 * MB)
    // Over the limit already (an admin lowered it): nothing more.
    expect(allowance(10 * MB, 12 * MB, 0)).toBe(0)
  })
})

describe("counted", () => {
  it("passes a body within the allowance on whole, and counts it", async () => {
    const source = body(3)
    const upload = counted(source.stream, 3 * MB)
    expect(await drain(upload.stream)).toBe(3 * MB)
    expect(upload.bytes()).toBe(3 * MB)
  })

  it("fails a body once past the allowance, without reading the rest", async () => {
    const source = body(100)
    const upload = counted(source.stream, 2.5 * MB)
    await expect(drain(upload.stream)).rejects.toThrow()
    expect(source.read()).toBeLessThan(10)
  })
})

describe("storageKeyProblem", () => {
  it("takes the app's own paths", () => {
    for (const key of ["invoice.pdf", "orders/123/invoice.pdf", "a b/ü ñ (1).png", ".hidden/x"]) {
      expect(storageKeyProblem(key)).toBeUndefined()
    }
  })

  it("refuses what is not one", () => {
    expect(storageKeyProblem("")).toBe("Between 1 and 1024 characters")
    expect(storageKeyProblem("x".repeat(1025))).toBe("Between 1 and 1024 characters")
    for (const key of ["/abs", "trailing/", "a//b", "a/../b", "./a", ".."]) {
      expect(storageKeyProblem(key)).toBe("Segments separated by /, none empty, . or ..")
    }
    expect(storageKeyProblem("a\nb")).toBe("No control characters or backslashes")
    expect(storageKeyProblem("a\\b")).toBe("No control characters or backslashes")
  })
})
