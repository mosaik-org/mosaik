import { describe, expect, it } from "@effect/vitest"
import { toSmtpError } from "./Smtp"

describe("toSmtpError", () => {
  it("treats SMTP 5xx replies as permanent", () => {
    expect(toSmtpError({ code: "EENVELOPE", responseCode: 550, message: "No such user" }).reason).toBe("BadRequest")
    expect(toSmtpError({ code: "EENVELOPE", message: "No recipients defined" }).reason).toBe("BadRequest")
  })

  it("treats 4xx replies and network failures as transient", () => {
    expect(toSmtpError({ code: "EENVELOPE", responseCode: 451, message: "Try later" }).reason).toBe("Unavailable")
    expect(toSmtpError({ code: "ECONNECTION", message: "Connection refused" }).reason).toBe("Unavailable")
    expect(toSmtpError(new Error("boom")).reason).toBe("Unavailable")
  })

  it("keeps the reasons of connection failures", () => {
    const error = Object.assign(new AggregateError([new Error("connect ECONNREFUSED 127.0.0.1:25")], ""), {
      code: "ESOCKET",
    })
    expect(toSmtpError(error).message).toBe("connect ECONNREFUSED 127.0.0.1:25")
  })

  it("reports authentication failures", () => {
    expect(toSmtpError({ code: "EAUTH", responseCode: 535, message: "Bad credentials" }).reason).toBe("Unauthorized")
  })
})
