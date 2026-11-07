import { makeApiClient } from "@mosaik/client"
import { createApi } from "@mosaik/client/solid"
import { ASSISTANT_API_PREFIX, AssistantApi, type Resolution, type SendMessage, type TurnEvent } from "../contract"
import { readEvents } from "./events"

/** The assistant's API: queries keyed by the contract, under `assistant.key`. */
export const assistant = createApi(AssistantApi)
/** The same API as plain calls. */
export const assistantClient = makeApiClient(AssistantApi)

/** A new, empty conversation. */
export const startConversation = () => assistantClient((client) => client.assistant.start())

/** Why a turn could not start: the API's message (`Conflict`, `BadRequest`) or the status. */
const refusal = async (response: Response) => {
  const body = (await response.json().catch(() => null)) as { readonly message?: string } | null
  return new Error(body?.message ?? `The assistant answered ${response.status}`)
}

/**
 * Runs a turn: posts to `path` and calls `onEvent` for each event of the stream it answers with,
 * until the turn ends. The API's endpoints answer with Server-Sent Events to a POST, which
 * `EventSource` cannot send, so the stream is read here.
 */
const streamTurn = async (
  path: string,
  body: unknown,
  onEvent: (event: TurnEvent) => void,
  signal?: AbortSignal,
): Promise<void> => {
  const response = await fetch(`${ASSISTANT_API_PREFIX}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify(body),
    ...(signal === undefined ? {} : { signal }),
  })
  if (!response.ok || response.body === null) throw await refusal(response)
  await readEvents(response.body, onEvent)
}

export const sendMessage = (
  conversation: string,
  message: typeof SendMessage.Type,
  onEvent: (event: TurnEvent) => void,
  signal?: AbortSignal,
) => streamTurn(`/conversations/${encodeURIComponent(conversation)}/messages`, message, onEvent, signal)

export const resolve = (
  conversation: string,
  resolutions: ReadonlyArray<Resolution>,
  onEvent: (event: TurnEvent) => void,
  signal?: AbortSignal,
) => streamTurn(`/conversations/${encodeURIComponent(conversation)}/calls`, { resolutions }, onEvent, signal)
