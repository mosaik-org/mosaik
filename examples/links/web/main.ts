import { errorMessage, formatDateTime, IdentityApi, makeApiClient, standaloneLinks } from "@mosaik/sdk/client"
import { Schema } from "effect"
import { type Link, LinksApi, NewLink } from "../api"
import { links as app } from "../manifest"

const linksApi = makeApiClient(LinksApi)
const identityApi = makeApiClient(IdentityApi)

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const account = element("account")
const form = element<HTMLFormElement>("add")
const problem = element("problem")
const list = element<HTMLUListElement>("links")

const show = (message: string | null) => {
  problem.hidden = message === null
  problem.textContent = message
}

/** Who is signed in, through Core: their name and what they may do. */
const { principal } = await identityApi((client) => client.identity.session())

const renderAccount = () => {
  if (principal.user === null) {
    const signIn = Object.assign(document.createElement("a"), {
      href: standaloneLinks.signIn(location.pathname),
      textContent: "Sign in with Mosaik",
    })
    account.replaceChildren(signIn)
    return
  }
  const signOut = Object.assign(document.createElement("form"), { method: "post", action: standaloneLinks.signOut })
  signOut.append(
    Object.assign(document.createElement("span"), { textContent: principal.user.name }),
    Object.assign(document.createElement("button"), { textContent: "Sign out" }),
  )
  account.replaceChildren(signOut)
}

const row = (link: Link) => {
  const item = document.createElement("li")
  const text = document.createElement("div")
  // The API accepts only http and https addresses, so this is safe to follow.
  const anchor = Object.assign(document.createElement("a"), {
    href: link.url,
    textContent: link.title,
    rel: "noopener",
  })
  const who = Object.assign(document.createElement("small"), {
    textContent: `${link.addedBy.name} · ${formatDateTime(link.addedAt)}`,
  })
  text.append(anchor, who)
  item.append(text)
  if (link.addedBy.id === principal.user?.id || principal.can(app.perm("links.remove"))) {
    const remove = Object.assign(document.createElement("button"), { textContent: "Remove" })
    remove.setAttribute("aria-label", `Remove ${link.title}`)
    remove.addEventListener(
      "click",
      () => void attempt(() => linksApi((client) => client.links.remove({ params: { id: link.id } }))),
    )
    item.append(remove)
  }
  return item
}

const refresh = async () => {
  const all = await linksApi((client) => client.links.list())
  list.replaceChildren(...all.map(row))
  if (all.length === 0) list.append(Object.assign(document.createElement("li"), { textContent: "No links yet." }))
}

/** Does something, then shows the links as they now are, or says what went wrong. */
const attempt = async (action: () => Promise<unknown>) => {
  show(null)
  await action().then(refresh, (cause: unknown) => show(errorMessage(cause)))
}

form.hidden = !principal.can(app.perm("links.add"))
form.addEventListener("submit", (event) => {
  event.preventDefault()
  const data = new FormData(form)
  // The API's own Schema checks the form, with its messages.
  const decoded = Schema.decodeUnknownExit(NewLink)({ title: data.get("title"), url: data.get("url") })
  if (decoded._tag === "Failure") return show("Give it a title and an address starting with http:// or https://")
  void attempt(() => linksApi((client) => client.links.add({ payload: decoded.value }))).then(() => form.reset())
})

renderAccount()
await refresh().catch((cause: unknown) => show(errorMessage(cause)))
