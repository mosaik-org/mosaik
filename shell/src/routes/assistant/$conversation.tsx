import { createFileRoute } from "@tanstack/solid-router"

/** One conversation: the page is the parent route's, which reads it from the address. */
export const Route = createFileRoute("/_app/assistant/$conversation")({ component: () => null })
