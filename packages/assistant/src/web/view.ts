import type { ConversationSummary, Message, ToolCallPart, ToolResultPart } from "../contract"

/**
 * How the conversation's parts are shown: what state each call is in, how a reply's calls are
 * summed up, how conversations group by date. Pure, so the views stay simple and this is tested.
 */

/** Where a call stands, from the results stored after it and the calls still waiting. */
export type CallStatus =
  | { readonly state: "running" }
  | { readonly state: "waiting" }
  | { readonly state: "done" }
  | { readonly state: "denied" }
  | { readonly state: "failed"; readonly reason: string }

export const callStatus = (
  call: ToolCallPart,
  results: ReadonlyMap<string, ToolResultPart>,
  pending: ReadonlySet<string>,
): CallStatus => {
  const result = results.get(call.id)
  // Browser calls wait too, but on the browser, which runs them at once.
  if (result === undefined) return pending.has(call.id) && call.changes ? { state: "waiting" } : { state: "running" }
  if (result.decision === "denied") return { state: "denied" }
  return result.ok ? { state: "done" } : { state: "failed", reason: result.text }
}

/** The results stored in a conversation, by the call they answer. */
export const resultsOf = (messages: ReadonlyArray<Message>): ReadonlyMap<string, ToolResultPart> =>
  new Map(
    messages.flatMap((message) =>
      message.parts.flatMap((part) => (part.type === "tool-result" ? [[part.id, part] as const] : [])),
    ),
  )

/**
 * What a conversation shows, in order: the person's messages, and the assistant's replies, each
 * reply being everything it wrote (and the results it got) until the person wrote again.
 */
export type ConversationItem =
  | { readonly kind: "question"; readonly message: Message }
  | { readonly kind: "reply"; readonly messages: ReadonlyArray<Message> }

export const conversationItems = (messages: ReadonlyArray<Message>): ReadonlyArray<ConversationItem> => {
  const items: Array<ConversationItem> = []
  for (const message of messages) {
    if (message.role === "user") {
      items.push({ kind: "question", message })
      continue
    }
    // Results of tool calls are shown with the calls, not on their own.
    if (message.role === "tool") continue
    const last = items.at(-1)
    if (last?.kind === "reply") items[items.length - 1] = { kind: "reply", messages: [...last.messages, message] }
    else items.push({ kind: "reply", messages: [message] })
  }
  return items
}

/**
 * What a reply shows, in order: its texts, and between them its tool calls, those in a row (even
 * across steps) as one activity, so a reply that looked things up five times shows one line.
 */
export type ReplyPart =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "activity"; readonly calls: ReadonlyArray<ToolCallPart> }

export const replyParts = (messages: ReadonlyArray<Message>): ReadonlyArray<ReplyPart> => {
  const parts: Array<ReplyPart> = []
  for (const part of messages.flatMap((message) => message.parts)) {
    if (part.type === "text" && part.text.trim() !== "") parts.push({ kind: "text", text: part.text })
    if (part.type !== "tool-call") continue
    const last = parts.at(-1)
    if (last?.kind === "activity") parts[parts.length - 1] = { kind: "activity", calls: [...last.calls, part] }
    else parts.push({ kind: "activity", calls: [part] })
  }
  return parts
}

/** A message's text, its text parts joined (what people read, and what "copy" copies). */
export const textOf = (message: Message): string =>
  message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n\n")

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/**
 * One line for a reply's calls: what is going on now if anything is, else what they came to,
 * e.g. "Find orders…", "Waiting for your approval", "Used 3 tools, 1 failed".
 */
export const activitySummary = (calls: ReadonlyArray<ToolCallPart>, statuses: ReadonlyArray<CallStatus>): string => {
  const running = calls.findLast((_, index) => statuses[index]?.state === "running")
  if (running !== undefined) return `${running.title}…`
  if (statuses.some((status) => status.state === "waiting")) return "Waiting for your approval"
  const failed = statuses.filter((status) => status.state === "failed").length
  const denied = statuses.filter((status) => status.state === "denied").length
  const only = calls.length === 1 ? calls[0] : undefined
  const used = only === undefined ? `Used ${plural(calls.length, "tool", "tools")}` : only.title
  const problems = [...(failed > 0 ? [`${failed} failed`] : []), ...(denied > 0 ? [`${denied} not allowed`] : [])]
  return problems.length === 0 ? used : `${used}, ${problems.join(", ")}`
}

/** What the assistant is doing while a turn runs, for the line under the conversation. */
export const liveActivity = (
  messages: ReadonlyArray<Message>,
  results: ReadonlyMap<string, ToolResultPart>,
): string | undefined => {
  const last = messages.at(-1)
  if (last?.role !== "assistant") return undefined
  const running = last.parts.findLast(
    (part): part is ToolCallPart => part.type === "tool-call" && !part.changes && !results.has(part.id),
  )
  return running === undefined ? undefined : `${running.title}…`
}

/** Conversations under headings by when they were last used: today, yesterday, the last week, earlier. */
export const groupByDate = (
  conversations: ReadonlyArray<ConversationSummary>,
  now: Date,
): ReadonlyArray<{ readonly label: string; readonly conversations: ReadonlyArray<ConversationSummary> }> => {
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const today = startOfDay(now)
  const day = 24 * 60 * 60 * 1000
  const labelOf = (conversation: ConversationSummary) => {
    const used = startOfDay(new Date(conversation.updatedAt.epochMilliseconds))
    if (used >= today) return "Today"
    if (used >= today - day) return "Yesterday"
    if (used >= today - 7 * day) return "Last 7 days"
    return "Earlier"
  }
  const groups: Array<{ label: string; conversations: Array<ConversationSummary> }> = []
  for (const conversation of conversations) {
    const label = labelOf(conversation)
    const group = groups.at(-1)?.label === label ? groups.at(-1) : undefined
    if (group === undefined) groups.push({ label, conversations: [conversation] })
    else group.conversations.push(conversation)
  }
  return groups
}

/** Conversations whose title has every word of the query, in any case. */
export const matchingConversations = (
  conversations: ReadonlyArray<ConversationSummary>,
  query: string,
): ReadonlyArray<ConversationSummary> => {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== "")
  if (words.length === 0) return conversations
  return conversations.filter((conversation) => {
    const title = conversation.title.toLowerCase()
    return words.every((word) => title.includes(word))
  })
}

/** What people read for a conversation without a title yet. */
export const titleOrDefault = (title: string) => (title === "" ? "New conversation" : title)
