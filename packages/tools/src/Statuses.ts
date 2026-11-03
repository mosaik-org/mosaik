import type { Principal } from "@mosaik/core"
import { type PersonStatus, statusSentence } from "@mosaik/platform/contract"
import { PlatformInternalClient } from "@mosaik/platform/server"
import { Context, Effect, Layer } from "effect"
import type { InputSchema, ToolOutcome } from "./Tools"

/**
 * What waits for a person in Mosaik (apps' and Core's statuses: things to approve, work running,
 * trouble), for AI front ends: the assistant tells its AI with each question, and both offer it
 * as a tool. Read from the platform for the person, so it is what they would see in the shell.
 */

/** A tool of Mosaik's own, read-only: what waits for the person now. */
export const WhatNeedsMe = {
  name: "what_needs_me",
  title: "What needs me",
  description:
    "What waits for the person across their apps in Mosaik: things to approve or answer (with how many), " +
    "work running, something new, apps in trouble, each with the path of the page it is about. " +
    "Use it when they ask what needs them, what is new or waiting, or what to do next.",
  input: { type: "object", properties: {}, required: [] } satisfies InputSchema,
} as const

const place = (status: PersonStatus) => status.app ?? "Mosaik"

/** Each status as a line the AI reads: its app, what it says, and where the things it is about are. */
export const describeStatuses = (statuses: ReadonlyArray<PersonStatus>): string =>
  statuses.length === 0
    ? "Nothing waits for the person."
    : statuses.map((status) => `- ${place(status)}: ${statusSentence(status)} (${status.link})`).join("\n")

/** One line for the start of the person's message, or nothing when nothing waits. */
export const waitingLine = (statuses: ReadonlyArray<PersonStatus>): string | undefined =>
  statuses.length === 0
    ? undefined
    : `[Waiting for the person: ${statuses.map((status) => `${place(status)}: ${statusSentence(status)} (${status.link})`).join("; ")}.]`

/** The tool's answer for the person. */
export const whatNeedsMe = (statuses: ReadonlyArray<PersonStatus>): ToolOutcome => ({
  ok: true,
  text: describeStatuses(statuses),
})

/** A person's statuses, from the platform. Best effort: without them, the AI only knows less. */
export class PersonStatuses extends Context.Service<
  PersonStatuses,
  { readonly forPrincipal: (principal: Principal) => Effect.Effect<ReadonlyArray<PersonStatus>> }
>()("@mosaik/tools/PersonStatuses") {
  static readonly layer = Layer.effect(
    PersonStatuses,
    Effect.gen(function* () {
      const platform = yield* PlatformInternalClient
      return PersonStatuses.of({
        forPrincipal: (principal) =>
          platform.statuses
            .forPrincipal({ payload: { principal } })
            .pipe(
              Effect.catchCause((cause) =>
                Effect.as(Effect.logWarning("Could not read the person's statuses", cause), []),
              ),
            ),
      })
    }),
  ).pipe(Layer.provide(PlatformInternalClient.layer))
}
