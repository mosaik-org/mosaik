import { describe, expect, it } from "vitest"
import { provideToaster, type Toast, toast } from "./shell"

describe("toast", () => {
  it("waits for a toaster, then goes to the one provided", () => {
    toast.success("Early")
    const shown: Array<Toast> = []
    const stop = provideToaster({ show: (next) => shown.push(next) })
    toast.error("Could not save", "The server is down")
    expect(shown).toEqual([
      { type: "success", title: "Early" },
      { type: "error", title: "Could not save", description: "The server is down" },
    ])
    stop()
    toast.info("Later")
    expect(shown).toHaveLength(2)
  })
})
