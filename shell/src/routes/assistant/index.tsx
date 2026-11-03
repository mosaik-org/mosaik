import { createFileRoute } from "@tanstack/solid-router"

/** A new conversation: the page is the parent route's. */
export const Route = createFileRoute("/_app/assistant/")({ component: () => null })
