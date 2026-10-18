import { describe, expect, it } from "@effect/vitest"
import { maskUrl } from "./Targets"

describe("maskUrl", () => {
  it("keeps the host and the last characters only", () => {
    expect(maskUrl("https://hooks.slack.com/services/T000/B000/XXXXsecret1234")).toBe("hooks.slack.com/…1234")
    expect(maskUrl("https://prod.westeurope.logic.azure.com/workflows/abc/triggers/manual?sig=s3cr3tAbCd")).toBe(
      "prod.westeurope.logic.azure.com/…AbCd",
    )
    expect(maskUrl("not a url")).toBe("…")
  })
})
