import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import { sessionCookie } from "./Tokens"
import { staticRoutes } from "./Upstreams"

describe("sessionCookie", () => {
  it("extracts only the session cookie", () => {
    expect(sessionCookie("theme=dark; mosaik.session_token=abc.def; other=1")).toBe("mosaik.session_token=abc.def")
    expect(sessionCookie("__Secure-mosaik.session_token=xyz")).toBe("__Secure-mosaik.session_token=xyz")
  })

  it("treats requests without a session as anonymous", () => {
    expect(sessionCookie(undefined)).toBe("")
    expect(sessionCookie("theme=dark")).toBe("")
  })
})

describe("staticRoutes", () => {
  it.effect("maps UPSTREAM_* variables to platform services with their own audience", () =>
    Effect.gen(function* () {
      const routes = yield* staticRoutes({
        UPSTREAM_AUTH: "http://auth:3000",
        UPSTREAM_ORDER_HISTORY: "http://orders:3000",
        UNRELATED: "x",
      })
      expect(routes.get("auth")?.url.origin).toBe("http://auth:3000")
      expect(routes.get("order-history")).toMatchObject({ audience: "order-history", scope: null })
      expect(routes.get("unknown")).toBeUndefined()
    }),
  )

  it.effect("requires the auth upstream", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(staticRoutes({ UPSTREAM_SALES: "http://sales:3000" }))
      expect(Exit.isFailure(exit)).toBe(true)
    }),
  )
})
