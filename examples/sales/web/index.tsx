import { searchValidator } from "@mosaik/sdk/solid"
import { AppLayout, defineWebApp } from "@mosaik/web-sdk/portal"
import { createRoute, lazyRouteComponent, stripSearchParams } from "@tanstack/solid-router"
import { ORDERS_DEFAULTS, OrdersSearch, SUMMARY_DEFAULTS, SummarySearch } from "../api"
import { sales } from "../manifest"
import "./styles.css"

/**
 * The browser side, mounted by the shell at /sales and loaded the first time someone opens
 * it. Each route validates its search params; its page reads them with `useSearchParams`.
 */
export default defineWebApp({
  // Its pages are listed from the manifest: in the shell's sidebar.
  component: () => <AppLayout app={sales} />,
  routes: (parent) => [
    createRoute({
      getParentRoute: () => parent,
      path: "/",
      staticData: { title: "Sales overview", keywords: ["revenue", "kpi", "charts"] },
      validateSearch: searchValidator(SummarySearch),
      // Defaults stay out of the URL.
      search: { middlewares: [stripSearchParams<SummarySearch>(SUMMARY_DEFAULTS)] },
      component: lazyRouteComponent(() => import("./pages/overview")),
    }),
    createRoute({
      getParentRoute: () => parent,
      path: "orders",
      // A table: it takes the whole width of the screen.
      staticData: { title: "Orders", keywords: ["refunds", "customers", "export"], layout: "wide" },
      validateSearch: searchValidator(OrdersSearch),
      search: { middlewares: [stripSearchParams<OrdersSearch>(ORDERS_DEFAULTS)] },
      component: lazyRouteComponent(() => import("./pages/orders")),
    }),
  ],
})
