import { describe, expect, it } from "@effect/vitest"
import { slackError } from "./Slack"

describe("slackError", () => {
  it("maps Slack error codes to connector reasons", () => {
    expect(slackError("invalid_auth").reason).toBe("Unauthorized")
    expect(slackError("channel_not_found").reason).toBe("NotFound")
    expect(slackError("not_in_channel").reason).toBe("BadRequest")
    expect(slackError("ratelimited").reason).toBe("RateLimited")
    expect(slackError("internal_error").reason).toBe("Unavailable")
  })
})
