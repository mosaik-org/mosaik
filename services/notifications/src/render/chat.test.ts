import { describe, expect, it } from "@effect/vitest"
import { escapeMrkdwn, renderSlack } from "./slack"
import { renderTeams } from "./teams"

const options = { publicUrl: "https://mosaik.example.com", source: "status" }
const content = {
  title: "auth is down",
  body: "Health check <failed> & timed out.\n\nSecond paragraph.",
  fields: [{ label: "Service", value: "auth" }],
  link: "/status",
  severity: "critical" as const,
}

describe("renderSlack", () => {
  it("renders header, body, fields, button and footer blocks", () => {
    const slack = renderSlack(content, options)
    expect(slack.text).toBe("auth is down\nHealth check <failed> & timed out.")
    expect(slack.blocks.map((block) => block.type)).toEqual(["header", "section", "section", "actions", "context"])
    expect(slack.blocks[0]).toMatchObject({ text: { type: "plain_text", text: ":rotating_light: auth is down" } })
    expect(slack.blocks[1]).toMatchObject({
      text: { type: "mrkdwn", text: "Health check &lt;failed&gt; &amp; timed out.\n\nSecond paragraph." },
    })
    expect(slack.blocks[3]).toMatchObject({
      elements: [{ type: "button", url: "https://mosaik.example.com/status", style: "danger" }],
    })
  })

  it("splits more than ten fields into several sections", () => {
    const fields = Array.from({ length: 12 }, (_, i) => ({ label: `f${i}`, value: String(i) }))
    const slack = renderSlack({ title: "x", fields }, options)
    expect(slack.blocks.filter((block) => "fields" in block)).toHaveLength(2)
  })

  it("escapes mrkdwn control characters", () => {
    expect(escapeMrkdwn("<!channel> & <https://evil|click>")).toBe("&lt;!channel&gt; &amp; &lt;https://evil|click&gt;")
  })
})

describe("renderTeams", () => {
  it("renders an Adaptive Card with facts and an open-URL action", () => {
    const card = renderTeams(content, options)
    expect(card).toMatchObject({ type: "AdaptiveCard", version: "1.5" })
    expect(card.body).toEqual([
      expect.objectContaining({ text: "auth is down", color: "Attention", weight: "Bolder" }),
      expect.objectContaining({ text: "Health check <failed> & timed out." }),
      expect.objectContaining({ text: "Second paragraph." }),
      { type: "FactSet", facts: [{ title: "Service", value: "auth" }] },
      expect.objectContaining({ text: "Sent by Mosaik (status)", isSubtle: true }),
    ])
    expect(card.actions).toEqual([
      { type: "Action.OpenUrl", title: "Open in Mosaik", url: "https://mosaik.example.com/status" },
    ])
  })
})
