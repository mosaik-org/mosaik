import { createRoot } from "solid-js"
import { describe, expect, it } from "vitest"
import { createFrameHeaderStack } from "./frameHeaderStack"

describe("createFrameHeaderStack", () => {
  it("shows the latest content, and what was shown before once it goes", () => {
    createRoot((dispose) => {
      const stack = createFrameHeaderStack()
      expect(stack.current()).toBeUndefined()
      const hideApp = stack.show(() => "Sales")
      const hidePage = stack.show(() => "SO-10045")
      expect(stack.current()).toBe("SO-10045")
      hidePage()
      expect(stack.current()).toBe("Sales")
      hideApp()
      expect(stack.current()).toBeUndefined()
      dispose()
    })
  })

  it("lets content go in any order", () => {
    createRoot((dispose) => {
      const stack = createFrameHeaderStack()
      const hideFirst = stack.show(() => "first")
      stack.show(() => "second")
      hideFirst()
      expect(stack.current()).toBe("second")
      dispose()
    })
  })
})
