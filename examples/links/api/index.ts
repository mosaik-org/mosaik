import { AccessControl, NotFound, RequiredPermission } from "@mosaik/sdk"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { links } from "../manifest"

/** Who added a link, kept with it: enough to show it without asking Core for every row. */
export class Person extends Schema.Class<Person>("@mosaik/links/Person")({
  id: Schema.String,
  name: Schema.String,
}) {}

export class Link extends Schema.Class<Link>("@mosaik/links/Link")({
  id: Schema.Int,
  title: Schema.String,
  url: Schema.String,
  addedBy: Person,
  addedAt: Schema.DateTimeUtc,
}) {}

export class NewLink extends Schema.Class<NewLink>("@mosaik/links/NewLink")({
  title: Schema.String.check(
    Schema.isTrimmed({ message: "No spaces around it" }),
    Schema.isMinLength(1, { message: "Give it a title" }),
    Schema.isMaxLength(120, { message: "At most 120 characters" }),
  ),
  // Only web addresses: pages render it as a link, and `javascript:` would run in them.
  url: Schema.String.check(
    Schema.isPattern(/^https?:\/\/\S+$/i, { message: "An address starting with http:// or https://" }),
    Schema.isMaxLength(2000, { message: "At most 2000 characters" }),
  ),
}) {}

export class LinksGroup extends HttpApiGroup.make("links").add(
  HttpApiEndpoint.get("list", "/links", { success: Schema.Array(Link) }),
  HttpApiEndpoint.post("add", "/links", { payload: NewLink, success: Link }).annotate(
    RequiredPermission,
    links.perm("links.add"),
  ),
  /** People remove what they added; curators anything. */
  HttpApiEndpoint.delete("remove", "/links/:id", {
    params: { id: Schema.NumberFromString.pipe(Schema.decodeTo(Schema.Int)) },
    success: HttpApiSchema.NoContent,
    error: NotFound,
  }).annotate(RequiredPermission, links.perm("links.add")),
) {}

export class LinksApi extends HttpApi.make("links").add(LinksGroup).prefix(links.apiPrefix).middleware(AccessControl) {}
