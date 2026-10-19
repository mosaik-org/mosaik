import { AccessControl, NotFound, PrincipalUser, RequiredPermission } from "@mosaik/sdk"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { notes } from "../manifest"

export class Note extends Schema.Class<Note>("@mosaik/notes/Note")({
  id: Schema.String,
  text: Schema.String,
  author: PrincipalUser,
  createdAt: Schema.DateTimeUtc,
}) {}

export class NewNote extends Schema.Class<NewNote>("@mosaik/notes/NewNote")({
  text: Schema.String.check(
    Schema.isTrimmed({ message: "No spaces around it" }),
    Schema.isMinLength(1, { message: "Write something first" }),
    Schema.isMaxLength(500, { message: "At most 500 characters" }),
  ),
}) {}

export class NotesGroup extends HttpApiGroup.make("notes").add(
  HttpApiEndpoint.get("list", "/notes", { success: Schema.Array(Note) }),
  HttpApiEndpoint.post("create", "/notes", { payload: NewNote, success: Note }).annotate(
    RequiredPermission,
    notes.perm("notes.write"),
  ),
  /** Authors delete their own notes; moderators anyone's. */
  HttpApiEndpoint.delete("delete", "/notes/:id", {
    params: { id: Schema.String },
    success: HttpApiSchema.NoContent,
    error: NotFound,
  }).annotate(RequiredPermission, notes.perm("notes.write")),
) {}

export class NotesApi extends HttpApi.make("notes").add(NotesGroup).prefix(notes.apiPrefix).middleware(AccessControl) {}
