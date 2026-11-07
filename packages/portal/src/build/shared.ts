/**
 * Modules the shell provides to apps at runtime (through an import map). Apps leave
 * them out of their bundles, so there is exactly one copy of each in the page:
 * Solid, the router and Query break with two copies, and the UI kit must match the shell.
 *
 * This list is part of the platform contract: changing it (or a major version of what
 * it contains) is a platform major release, and every app is rebuilt.
 */
export const SHARED_MODULES = [
  "solid-js",
  "solid-js/web",
  "solid-js/store",
  "@tanstack/solid-router",
  "@tanstack/solid-query",
  "effect",
  "effect/http",
  "effect/http-api",
  // The SDK's browser entry points (apps import nothing else of Mosaik's).
  "@mosaik/sdk",
  "@mosaik/sdk/client",
  "@mosaik/sdk/solid",
  "@mosaik/sdk/router",
  "@mosaik/web-sdk/portal",
  "@mosaik/web-sdk/ui",
  "@mosaik/web-sdk/table",
  "@mosaik/web-sdk/charts",
  // The component library apps import directly: one copy, styled by the shell's stylesheet.
  "@mosaik/mosaik-ui",
  // Not `@mosaik/web-sdk/css` and its siblings: each app generates its own (see `appPandaConfig`), so its
  // atomic classes never collide with the shell's (they would override each other's media queries).
] as const

export type SharedModule = (typeof SHARED_MODULES)[number]

/** File name of a shared module's wrapper in the shell (`src/shared/<slug>.ts`). */
export const sharedSlug = (specifier: string) => specifier.replace(/^@/, "").replaceAll("/", "__")
