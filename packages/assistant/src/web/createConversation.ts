import { errorMessage } from "@mosaik/client"
import { useBusy } from "@mosaik/client/solid"
import { useQuery, useQueryClient } from "@tanstack/solid-query"
import { type Accessor, createEffect, createMemo, on } from "solid-js"
import { createStore, produce } from "solid-js/store"
import type { Message, PageContext, ToolCallPart, ToolResultPart, TurnEvent } from "../contract"
import { assistant, resolve, sendMessage, startConversation } from "./api"
import { useAssistantBrowser } from "./browser"
import { runBrowserCall } from "./browserCalls"
import { resultsOf } from "./view"

/** One request of a turn: it streams the turn's events until the turn ends or waits. */
type Turn = (onEvent: (event: TurnEvent) => void, signal: AbortSignal) => Promise<void>

export interface ConversationState {
  readonly messages: ReadonlyArray<Message>
  /** Calls waiting to be resolved: changes for the person, browser tools for the browser. */
  readonly pending: ReadonlyArray<ToolCallPart>
  /** The reply being written, until it is stored. */
  readonly draft: string
  readonly busy: boolean
  readonly error: string | null
}

export interface ConversationModel {
  readonly state: ConversationState
  readonly results: Accessor<ReadonlyMap<string, ToolResultPart>>
  readonly pendingIds: Accessor<ReadonlySet<string>>
  readonly send: (text: string) => Promise<void>
  readonly decide: (call: ToolCallPart, approve: boolean) => Promise<void>
  /** Stops the turn: the reply stops where it is, and nothing more runs. */
  readonly stop: () => void
  /** Takes the person to a page of Mosaik, with the conversation beside it (links in replies). */
  readonly navigate: (path: string) => void
}

/**
 * A conversation with the assistant, without its looks: what is shown (stored messages, the reply
 * being written, the calls waiting), and sending, deciding and stopping. The views (panel, page)
 * render it.
 */
export const createConversation = (options: {
  readonly conversation: Accessor<string | null>
  /** A new conversation was started by the first message. */
  readonly onStarted: (conversation: string) => void
  /** Where the person is, sent with each message. */
  readonly context: Accessor<PageContext | null>
}): ConversationModel => {
  const queryClient = useQueryClient()
  const browser = useAssistantBrowser()
  const [state, setState] = createStore<{
    messages: Array<Message>
    pending: Array<ToolCallPart>
    draft: string
    busy: boolean
    error: string | null
  }>({ messages: [], pending: [], draft: "", busy: false, error: null })
  // The conversation the first message just started: already shown, so not reset when it is chosen.
  let started: string | null = null
  let running: AbortController | undefined

  const loaded = useQuery(() => ({
    ...assistant.assistant.conversation.query({ params: { id: options.conversation() ?? "" } }),
    enabled: options.conversation() !== null,
  }))

  // Another conversation starts from nothing, until it loads.
  createEffect(
    on(options.conversation, (id) => {
      if (id !== null && id === started) return
      started = null
      setState({ messages: [], pending: [], draft: "", error: null })
    }),
  )
  // A loaded conversation replaces what is shown, except while a turn adds to it.
  createEffect(
    on(
      () => loaded.data,
      (data) => {
        if (data === undefined || state.busy || data.id !== options.conversation()) return
        // Not the error: a failed turn reloads the conversation, and its error must stay in view.
        setState({ messages: [...data.messages], pending: [...data.pending] })
      },
    ),
  )

  // While a reply is being written, navigation shows it beside the assistant, wherever the person is.
  useBusy(() => state.busy, { label: "The assistant is answering", path: "/assistant" })

  const results = createMemo(() => resultsOf(state.messages))
  const pendingIds = createMemo(() => new Set(state.pending.map((call) => call.id)))

  const onEvent = (event: TurnEvent) => {
    switch (event.type) {
      case "text":
        return setState("draft", (draft) => draft + event.text)
      case "message":
        return setState(
          produce((draft) => {
            draft.messages.push(event.message)
            if (event.message.role === "assistant") draft.draft = ""
          }),
        )
      case "waiting":
        return setState("pending", [...event.calls])
      case "done":
        return
      case "failed":
        return setState("error", event.message)
    }
  }

  /**
   * Runs a turn to its end, then reloads what was stored. Calls the browser runs (finding and
   * opening pages) are run here as they come, and their results continue the turn; the person
   * is taken to a page only once the reply is complete. Changes stay for the person to decide.
   */
  const run = async (conversation: string, turn: Turn) => {
    const controller = new AbortController()
    running = controller
    setState({ busy: true, error: null, draft: "" })
    let destination: string | undefined
    try {
      for (let next: Turn | undefined = turn; next !== undefined; ) {
        setState("pending", [])
        await next(onEvent, controller.signal)
        const inBrowser = state.pending.filter((call) => call.runsIn === "browser")
        if (inBrowser.length === 0 || controller.signal.aborted) break
        const outcomes = await Promise.all(inBrowser.map((call) => runBrowserCall(call, browser)))
        destination = outcomes.findLast((outcome) => outcome.navigateTo !== undefined)?.navigateTo ?? destination
        const resolutions = outcomes.map((outcome) => outcome.resolution)
        next = (onEvent, signal) => resolve(conversation, resolutions, onEvent, signal)
      }
    } catch (error) {
      // Stopping is no error: the reply just ends where it was.
      if (!controller.signal.aborted) setState("error", errorMessage(error))
    } finally {
      running = undefined
      setState({ busy: false, draft: "" })
      await queryClient.invalidateQueries({ queryKey: assistant.assistant.key() })
    }
    if (destination !== undefined && !controller.signal.aborted) browser?.openPage(destination, conversation)
  }

  return {
    state,
    results,
    pendingIds,
    send: async (text) => {
      const message = text.trim()
      if (message === "" || state.busy) return
      let id = options.conversation()
      if (id === null) {
        try {
          id = (await startConversation()).id
        } catch (error) {
          setState("error", errorMessage(error))
          return
        }
        started = id
        options.onStarted(id)
      }
      const conversation = id
      await run(conversation, (onEvent, signal) =>
        sendMessage(conversation, { text: message, context: options.context() }, onEvent, signal),
      )
    },
    decide: async (call, approve) => {
      const id = options.conversation()
      if (id === null || state.busy) return
      await run(id, (onEvent, signal) => resolve(id, [{ type: "decision", call: call.id, approve }], onEvent, signal))
      // An allowed change may have changed what the page shows: everything is fetched again.
      if (approve) await queryClient.invalidateQueries()
    },
    stop: () => running?.abort(),
    navigate: (path) => {
      const conversation = options.conversation()
      if (conversation !== null) browser?.openPage(path, conversation)
    },
  }
}
