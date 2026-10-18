import { errorMessage, IdentityApi, makeApiClient } from "@mosaik/sdk/client"
import { createResource, createSignal, For, Show } from "solid-js"
import { render } from "solid-js/web"
import { NewNote, type Note, NotesApi } from "../api"
import { notes as app } from "../manifest"
import "./styles.css"

const notesApi = makeApiClient(NotesApi)
const identityApi = makeApiClient(IdentityApi)

/** Who is signed in (through Core), as the app's backend sees it. */
const [session] = createResource(() => identityApi((client) => client.identity.session()))
const principal = () => session()?.principal

const signInHref = () => `/auth/sign-in?return=${encodeURIComponent(location.pathname)}`

const Header = () => (
  <header class="header">
    <strong>Notes</strong>
    <Show when={principal()?.user} fallback={<a href={signInHref()}>Sign in with Mosaik</a>}>
      {(user) => (
        <form method="post" action="/auth/sign-out" class="who">
          <span>{user().name}</span>
          <button type="submit" class="link">
            Sign out
          </button>
        </form>
      )}
    </Show>
  </header>
)

const NoteList = () => {
  const [list, { refetch }] = createResource(() => notesApi((client) => client.notes.list()))
  const [text, setText] = createSignal("")
  const [error, setError] = createSignal<string>()
  const can = (permission: string) => principal()?.can(permission) ?? false

  const post = async (event: SubmitEvent) => {
    event.preventDefault()
    try {
      await notesApi((client) => client.notes.create({ payload: new NewNote({ text: text().trim() }) }))
      setText("")
      setError(undefined)
      await refetch()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  const remove = async (note: Note) => {
    await notesApi((client) => client.notes.delete({ params: { id: note.id } })).catch((cause: unknown) =>
      setError(errorMessage(cause)),
    )
    await refetch()
  }

  return (
    <>
      <Show when={can(app.perm("notes.write"))}>
        <form class="compose" onSubmit={post}>
          <textarea
            value={text()}
            onInput={(event) => setText(event.currentTarget.value)}
            placeholder="Write a note for the team"
            maxLength={500}
            rows={3}
          />
          <button type="submit" disabled={text().trim() === ""}>
            Post
          </button>
        </form>
      </Show>
      <Show when={error()}>{(message) => <p class="error">{message()}</p>}</Show>
      <ul class="notes">
        <For each={list() ?? []} fallback={<li class="empty">No notes yet.</li>}>
          {(note) => (
            <li>
              <p>{note.text}</p>
              <footer>
                <span>
                  {note.author.name} · {new Date(note.createdAt.epochMilliseconds).toLocaleString()}
                </span>
                <Show when={note.author.id === principal()?.user?.id || can(app.perm("notes.delete"))}>
                  <button type="button" class="link" onClick={() => void remove(note)}>
                    Delete
                  </button>
                </Show>
              </footer>
            </li>
          )}
        </For>
      </ul>
    </>
  )
}

const App = () => (
  <>
    <Header />
    <main class="main">
      <Show when={!session.loading}>
        <Show
          when={principal()?.can(app.accessPermission)}
          fallback={
            <p class="empty">
              <Show when={principal()?.user} fallback={<a href={signInHref()}>Sign in</a>}>
                You cannot read notes yet: ask an admin for access.
              </Show>
            </p>
          }
        >
          <NoteList />
        </Show>
      </Show>
    </main>
  </>
)

const root = document.getElementById("root")
if (root === null) throw new Error("No #root element")
render(() => <App />, root)
