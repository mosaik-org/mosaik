import { describe, expect, it } from "@effect/vitest"
import { isAllowedRedirect, isMetadataDocumentId, matchesRedirect } from "./AgentClients"
import { pkceChallenge } from "./AgentConnections"

describe("isAllowedRedirect", () => {
  it("allows https, http on this computer, and apps' own schemes", () => {
    expect(isAllowedRedirect("https://assistant.example.com/api/mcp/auth_callback")).toBe(true)
    expect(isAllowedRedirect("http://localhost:33418/callback")).toBe(true)
    expect(isAllowedRedirect("http://127.0.0.1:5000/cb")).toBe(true)
    expect(isAllowedRedirect("http://[::1]:5000/cb")).toBe(true)
    expect(isAllowedRedirect("cursor://anysphere.cursor-retrieval/oauth/callback")).toBe(true)
  })

  it("refuses http elsewhere, scripts, fragments and credentials", () => {
    expect(isAllowedRedirect("http://evil.example/cb")).toBe(false)
    expect(isAllowedRedirect("javascript:alert(1)")).toBe(false)
    expect(isAllowedRedirect("data:text/html,hi")).toBe(false)
    expect(isAllowedRedirect("https://assistant.example.com/cb#x")).toBe(false)
    expect(isAllowedRedirect("https://user:pass@assistant.example.com/cb")).toBe(false)
    expect(isAllowedRedirect("not a url")).toBe(false)
  })
})

describe("matchesRedirect", () => {
  it("matches exactly", () => {
    expect(matchesRedirect("https://assistant.example.com/cb", ["https://assistant.example.com/cb"])).toBe(true)
    expect(matchesRedirect("https://assistant.example.com/cb2", ["https://assistant.example.com/cb"])).toBe(false)
    expect(matchesRedirect("https://assistant.example.com:8443/cb", ["https://assistant.example.com/cb"])).toBe(false)
  })

  it("lets local clients pick any port, nothing else", () => {
    expect(matchesRedirect("http://127.0.0.1:61234/callback", ["http://127.0.0.1/callback"])).toBe(true)
    expect(matchesRedirect("http://localhost:61234/callback", ["http://localhost:3000/callback"])).toBe(true)
    expect(matchesRedirect("http://localhost:61234/other", ["http://localhost:3000/callback"])).toBe(false)
    expect(matchesRedirect("http://127.0.0.1:61234/callback", ["http://localhost/callback"])).toBe(false)
  })
})

describe("isMetadataDocumentId", () => {
  it("is an https address with a path", () => {
    expect(isMetadataDocumentId("https://assistant.example.com/oauth/client-metadata")).toBe(true)
    expect(isMetadataDocumentId("https://assistant.example.com/")).toBe(false)
    expect(isMetadataDocumentId("http://assistant.example.com/client.json")).toBe(false)
    expect(isMetadataDocumentId("mosaik-Ab3")).toBe(false)
  })
})

describe("pkceChallenge", () => {
  it("is S256 (RFC 7636 appendix B)", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    )
  })
})
