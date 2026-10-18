import { describe, expect, it } from "@effect/vitest"
import { renderEmail, resolveLink } from "./email"

const options = { publicUrl: "https://mosaik.example.com", source: "sales" }

describe("renderEmail", () => {
  it("renders title, paragraphs, fields and link as text and HTML", () => {
    const email = renderEmail(
      {
        title: "Refund requested",
        body: "Order SO-1 needs approval.\n\nReason: damaged",
        fields: [{ label: "Amount", value: "€120.00" }],
        link: "/sales/orders/1",
      },
      options,
    )
    expect(email.subject).toBe("Refund requested")
    expect(email.text).toBe(
      [
        "Refund requested",
        "Order SO-1 needs approval.",
        "Reason: damaged",
        "Amount: €120.00",
        "Open in Mosaik: https://mosaik.example.com/sales/orders/1",
        "-- \nSent by Mosaik (sales). This is an automated message.",
      ].join("\n\n"),
    )
    expect(email.html).toContain('<p style="margin:0 0 16px">Order SO-1 needs approval.</p>')
    expect(email.html).toContain('href="https://mosaik.example.com/sales/orders/1"')
    expect(email.html).toContain(">Amount</td>")
  })

  it("escapes HTML in every user-provided value", () => {
    const email = renderEmail(
      {
        title: "<b>Hi</b>",
        body: "<script>alert(1)</script>",
        fields: [{ label: "<i>", value: '"quoted" & more' }],
        link: 'https://example.com/?q="><script>',
        linkLabel: "<Open>",
      },
      options,
    )
    expect(email.html).not.toContain("<script>")
    expect(email.html).not.toContain("<b>Hi</b>")
    expect(email.html).toContain("&lt;b&gt;Hi&lt;/b&gt;")
    expect(email.html).toContain("&quot;quoted&quot; &amp; more")
    expect(email.html).toContain('href="https://example.com/?q=&quot;&gt;&lt;script&gt;"')
    expect(email.html).toContain("&lt;Open&gt;")
  })

  it("prefixes the subject of warnings and critical messages", () => {
    expect(renderEmail({ title: "Disk full", severity: "critical" }, options).subject).toBe("[Critical] Disk full")
    expect(renderEmail({ title: "Slow", severity: "warning" }, options).subject).toBe("[Warning] Slow")
    expect(renderEmail({ title: "Done", severity: "success" }, options).subject).toBe("Done")
  })

  it("labels external links generically", () => {
    const email = renderEmail({ title: "Report", link: "https://bi.example.com/r/1" }, options)
    expect(email.text).toContain("Open: https://bi.example.com/r/1")
  })
})

describe("resolveLink", () => {
  it("resolves app paths against the public URL and keeps absolute URLs", () => {
    expect(resolveLink("/status", "https://mosaik.example.com")).toBe("https://mosaik.example.com/status")
    expect(resolveLink("/status", "https://mosaik.example.com/base/")).toBe("https://mosaik.example.com/status")
    expect(resolveLink("https://other.example.com/x", "https://mosaik.example.com")).toBe("https://other.example.com/x")
  })
})
