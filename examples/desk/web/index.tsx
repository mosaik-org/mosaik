import { Button } from "@mosaik/mosaik-ui"
import { AppLayout, defineWebApp } from "@mosaik/sdk/portal"
import { searchValidator } from "@mosaik/sdk/solid"
import { createRoute, lazyRouteComponent } from "@tanstack/solid-router"
import { Schema } from "effect"
import Plus from "lucide-solid/icons/plus"
import { RequestsSearch } from "../api"
import { desk } from "../manifest"
import { DeskProvider, useDesk } from "./context"
import "./styles.css"

const SetupSearch = Schema.Struct({ tab: Schema.optional(Schema.Literals(["queues", "deadlines", "replies"])) })

const NewRequestButton = () => {
  const { newRequest } = useDesk()
  return (
    <Button size="sm" variant="subtle" colorPalette="gray" onClick={() => newRequest.open()}>
      <Plus />
      New request
    </Button>
  )
}

/**
 * The browser side, mounted by the shell at /desk. The three lists are one page shown three ways
 * (see `workspace/Workspace`), each with the whole screen: a list, and what is open beside it.
 */
export default defineWebApp({
  component: () => (
    <DeskProvider>
      <AppLayout app={desk} actions={<NewRequestButton />} />
    </DeskProvider>
  ),
  routes: (parent) => {
    const list = {
      getParentRoute: () => parent,
      validateSearch: searchValidator(RequestsSearch),
    }
    return [
      createRoute({
        ...list,
        path: "/",
        staticData: { title: "Inbox", keywords: ["requests", "tickets", "service desk"], layout: "full" },
        component: lazyRouteComponent(() => import("./pages/inbox")),
      }),
      createRoute({
        ...list,
        path: "all",
        staticData: { title: "All requests", keywords: ["tickets", "queues"], layout: "full" },
        component: lazyRouteComponent(() => import("./pages/all")),
      }),
      createRoute({
        ...list,
        path: "mine",
        staticData: { title: "My requests", keywords: ["help", "support", "ask"], layout: "full" },
        component: lazyRouteComponent(() => import("./pages/mine")),
      }),
      createRoute({
        getParentRoute: () => parent,
        path: "setup",
        staticData: { title: "Service desk setup", keywords: ["queues", "deadlines", "saved replies"] },
        validateSearch: searchValidator(SetupSearch),
        component: lazyRouteComponent(() => import("./pages/setup")),
      }),
    ]
  },
})
