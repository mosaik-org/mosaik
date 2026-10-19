import { TokenVerifier } from "@mosaik/auth/server"
import { Principal } from "@mosaik/core"
import { Config, Context, Effect, Layer, Option } from "effect"
import { Headers, type HttpServerRequest, HttpServerResponse } from "effect/http"

/** How Core's own pages look: the company's name, logo and colour (`BRAND_NAME`, `BRAND_LOGO_URL`, `BRAND_COLOR`). */
export interface Branding {
  readonly name: string
  readonly logoUrl: Option.Option<string>
  readonly color: string
}

export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

/** A path on this origin: never another site (`//evil.example` is one). */
export const localPath = (value: string | null | undefined, fallback = "/"): string =>
  value?.startsWith("/") && !value.startsWith("//") ? value : fallback

/** Whether `uri` is the address `base` or below it (same origin, path under the base path, no credentials). */
export const isUnder = (uri: string, base: string): boolean => {
  if (!URL.canParse(uri) || !URL.canParse(base)) return false
  const target = new URL(uri)
  const root = new URL(base)
  const path = root.pathname.endsWith("/") ? root.pathname : `${root.pathname}/`
  return target.origin === root.origin && `${target.pathname}/`.startsWith(path) && target.username === ""
}

/** The request's path and query, e.g. to come back to it after signing in. */
export const pathOf = (request: HttpServerRequest.HttpServerRequest): string => {
  const url = new URL(request.url, "http://core")
  return `${url.pathname}${url.search}`
}

export const formOf = (request: HttpServerRequest.HttpServerRequest) =>
  request.text.pipe(
    Effect.map((text) => new URLSearchParams(text)),
    Effect.orElseSucceed(() => new URLSearchParams()),
  )

export interface PageOptions {
  readonly title: string
  /** HTML, escaped by the caller. */
  readonly body: string
  readonly status?: number
}

/**
 * Core's own pages, rendered on the server (sign-in, requesting access, notification settings):
 * they need no build and work in every deployment, with or without the console or the Portal.
 */
export class CorePages extends Context.Service<
  CorePages,
  {
    readonly branding: Branding
    page(options: PageOptions): HttpServerResponse.HttpServerResponse
    /** A page that only says something (and offers a link onwards). */
    message(
      title: string,
      text: string,
      link?: { readonly href: string; readonly label: string },
    ): HttpServerResponse.HttpServerResponse
    /** Who is signing in, from the gateway's token (anonymous without one). */
    principal(request: HttpServerRequest.HttpServerRequest): Effect.Effect<Principal>
  }
>()("@mosaik/server/CorePages") {
  /** Needs the service's `TokenVerifier`: the one checking the tokens the gateway issues for it. */
  static readonly layer = Layer.effect(
    CorePages,
    Effect.gen(function* () {
      const verifier = yield* TokenVerifier
      const branding: Branding = {
        name: yield* Config.String("BRAND_NAME").pipe(Config.withDefault("Mosaik")),
        logoUrl: yield* Config.String("BRAND_LOGO_URL").pipe(
          Config.option,
          Config.map(Option.filter((url) => url.length > 0)),
        ),
        color: yield* Config.String("BRAND_COLOR").pipe(
          Config.withDefault("#2563eb"),
          Config.map((color) => (/^#[0-9a-fA-F]{3,8}$/.test(color) ? color : "#2563eb")),
        ),
      }
      const mark = Option.match(branding.logoUrl, {
        onNone: () => `<span class="mark" aria-hidden="true">${escapeHtml(branding.name.slice(0, 1))}</span>`,
        onSome: (url) => `<img class="logo" src="${escapeHtml(url)}" alt="">`,
      })

      const page = ({ title, body, status = 200 }: PageOptions) =>
        HttpServerResponse.html(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · ${escapeHtml(branding.name)}</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; --accent: ${branding.color}; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: Canvas; color: CanvasText; }
  main { width: min(26rem, calc(100vw - 2rem)); display: grid; gap: 1rem; padding: 2rem 0; }
  header { display: flex; align-items: center; gap: 0.625rem; font-weight: 600; }
  .mark { display: grid; place-items: center; width: 2rem; height: 2rem; border-radius: 0.5rem; background: var(--accent); color: white; }
  .logo { height: 2rem; }
  h1 { font-size: 1.25rem; margin: 0; }
  p { margin: 0; }
  form { display: grid; gap: 0.75rem; }
  label { display: grid; gap: 0.25rem; font-size: 0.875rem; }
  input, textarea { font: inherit; padding: 0.5rem; border: 1px solid GrayText; border-radius: 0.375rem; background: Canvas; color: inherit; }
  fieldset { border: 1px solid color-mix(in srgb, GrayText 50%, transparent); border-radius: 0.375rem; display: grid; gap: 0.5rem; }
  .choice { display: flex; gap: 0.5rem; align-items: flex-start; font-size: 0.875rem; }
  button, .button { font: inherit; padding: 0.5rem 1rem; border: 0; border-radius: 0.375rem; background: var(--accent); color: white; cursor: pointer; text-align: center; text-decoration: none; }
  .secondary { background: transparent; color: var(--accent); border: 1px solid var(--accent); }
  table { border-collapse: collapse; font-size: 0.875rem; }
  th, td { padding: 0.375rem 0.5rem; text-align: left; border-bottom: 1px solid color-mix(in srgb, GrayText 30%, transparent); }
  td.check, th.check { text-align: center; }
  a { color: var(--accent); }
  .error { color: #dc2626; }
  .hint { color: GrayText; font-size: 0.875rem; }
</style>
</head>
<body><main>
<header>${mark}<span>${escapeHtml(branding.name)}</span></header>
${body}
</main></body>
</html>`).pipe(HttpServerResponse.setStatus(status), HttpServerResponse.setHeader("cache-control", "no-store"))

      return CorePages.of({
        branding,
        page,
        message: (title, text, link) =>
          page({
            title,
            body: `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(text)}</p>${
              link === undefined
                ? ""
                : `<a class="button" href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`
            }`,
          }),
        principal: (request) => {
          const header = Option.getOrUndefined(Headers.get(request.headers, "authorization"))
          const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined
          const anonymous = new Principal({ user: null, grants: [] })
          return token === undefined
            ? Effect.succeed(anonymous)
            : verifier.verify(token).pipe(Effect.orElseSucceed(() => anonymous))
        },
      })
    }),
  )
}
