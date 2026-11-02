import { describe, expect, it } from "@effect/vitest"
import { isAllowedRedirect, isMetadataDocumentId, matchesRedirect } from "./AgentClients"
import { pkceChallenge } from "./AgentConnections"

describe("isAllowedRedirect", () => {
  it("allows https, http on this computer, and apps' own schemes", () => {
    expect(isAllowedRedirect("https://claude.ai/api/mcp/auth_callback")).toBe(true)
    expect(isAllowedRedirect("http://localhost:33418/callback")).toBe(true)
    expect(isAllowedRedirect("http://127.0.0.1:5000/cb")).toBe(true)
    expect(isAllowedRedirect("http://[::1]:5000/cb")).toBe(true)
    expect(isAllowedRedirect("cursor://anysphere.cursor-retrieval/oauth/callback")).toBe(true)
  })

  it("refuses http elsewhere, scripts, fragments and credentials", () => {
    expect(isAllowedRedirect("http://evil.example/cb")).toBe(false)
    expect(isAllowedRedirect("javascript:alert(1)")).toBe(false)
    expect(isAllowedRedirect("data:text/html,hi")).toBe(false)
    expect(isAllowedRedirect("https://claude.ai/cb#x")).toBe(false)
    expect(isAllowedRedirect("https://user:pass@claude.ai/cb")).toBe(false)
    expect(isAllowedRedirect("not a url")).toBe(false)
  })
})

describe("matchesRedirect", () => {
  it("matches exactly", () => {
    expect(matchesRedirect("https://claude.ai/cb", ["https://claude.ai/cb"])).toBe(true)
    expect(matchesRedirect("https://claude.ai/cb2", ["https://claude.ai/cb"])).toBe(false)
    expect(matchesRedirect("https://claude.ai:8443/cb", ["https://claude.ai/cb"])).toBe(false)
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
    expect(isMetadataDocumentId("https://claude.ai/oauth/claude-code-client-metadata")).toBe(true)
    expect(isMetadataDocumentId("https://claude.ai/")).toBe(false)
    expect(isMetadataDocumentId("http://claude.ai/client.json")).toBe(false)
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
