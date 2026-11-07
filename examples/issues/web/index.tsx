import { AppLayout, defineWebApp } from "@mosaik/sdk/portal"
import { searchValidator } from "@mosaik/sdk/solid"
import { createRoute, lazyRouteComponent } from "@tanstack/solid-router"
import { IssuesSearch } from "../api"
import { issues } from "../manifest"
import "./styles.css"

/**
 * The browser side, mounted by the shell at /issues and loaded the first time someone opens
 * it. The route validates its search params; the page reads them with `useSearchParams`.
 */
export default defineWebApp({
  component: () => <AppLayout app={issues} />,
  routes: (parent) => [
    createRoute({
      getParentRoute: () => parent,
      path: "/",
      staticData: { title: "Jira issues", keywords: ["jira", "tickets", "bugs", "backlog"] },
      validateSearch: searchValidator(IssuesSearch),
      component: lazyRouteComponent(() => import("./pages/issues")),
    }),
  ],
})
