import { NOTIFICATION_LINK_PAGE } from "@mosaik/notifications/contract"
import { describe, expect, it } from "vitest"
import type { OutgoingDelivery } from "./channels/Channel"
import { linkedThroughCore } from "./Worker"

const delivery = (overrides: Partial<OutgoingDelivery> = {}): OutgoingDelivery => ({
  id: 1,
  messageId: 42,
  category: "notification",
  source: "sales",
  kind: "refund.approval",
  subject: "refund:7",
  channel: "email",
  recipient: "ada@example.com",
  recipientName: "Ada",
  attempts: 1,
  content: { title: "Approve the refund", link: "/sales/orders/7" },
  ...overrides,
})

const throughCore = `${NOTIFICATION_LINK_PAGE}?message=42`

describe("linkedThroughCore", () => {
  it("sends a person's link about a subject through Core's page, which knows if it was resolved", () => {
    expect(linkedThroughCore(delivery()).content.link).toBe(throughCore)
    expect(linkedThroughCore(delivery({ channel: "slack-user" })).content.link).toBe(throughCore)
  })

  it("leaves other links as they are", () => {
    // A channel admins route it to: its readers did not receive it as people.
    expect(linkedThroughCore(delivery({ channel: "target" })).content.link).toBe("/sales/orders/7")
    expect(linkedThroughCore(delivery({ subject: null })).content.link).toBe("/sales/orders/7")
    expect(linkedThroughCore(delivery({ category: "message" })).content.link).toBe("/sales/orders/7")
    expect(linkedThroughCore(delivery({ content: { title: "No link" } })).content.link).toBeUndefined()
  })
})
