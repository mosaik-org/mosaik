import { Button, Card, EmptyState, TextareaField, ThemeProvider, ThemeToggle } from "@mosaik/mosaik-ui"
import { errorMessage, IdentityApi, makeApiClient, standaloneLinks, toast } from "@mosaik/sdk/client"
import { createForm } from "@mosaik/sdk/solid"
import { Toasts } from "@mosaik/web-sdk/ui"
import { createResource, For, Show } from "solid-js"
import { render } from "solid-js/web"
import { NewNote, type Note, NotesApi } from "../api"
import { notes as app } from "../manifest"
// The UI kit's stylesheet: a standalone page has no shell to provide it.
import "@mosaik/web-sdk/ui/styles.css"
import "./styles.css"

const notesApi = makeApiClient(NotesApi)
const identityApi = makeApiClient(IdentityApi)

/** Who is signed in (through Core), as the app's backend sees it. */
const [session] = createResource(() => identityApi((client) => client.identity.session()))
const principal = () => session()?.principal

// Served by the app's own backend, which takes the browser on to Core's pages and back.
const here = () => location.pathname

const Header = () => (
  <header class="header">
    <strong>Notes</strong>
    <div class="who">
      <Show
        when={principal()?.user}
        fallback={
          <a class="link" href={standaloneLinks.signIn(here())}>
            Sign in with Mosaik
          </a>
        }
      >
        {(user) => (
          <form method="post" action={standaloneLinks.signOut} class="who">
            <span>{user().name}</span>
            <a class="link" href={standaloneLinks.notificationSettings}>
              Notifications
            </a>
            <Button type="submit" variant="plain" size="xs">
              Sign out
            </Button>
          </form>
        )}
      </Show>
      <ThemeToggle />
    </div>
  </header>
)

const NoteList = () => {
  const [list, { refetch }] = createResource(() => notesApi((client) => client.notes.list()))
  const can = (permission: string) => principal()?.can(permission) ?? false

  // The API's own payload Schema checks the form, with its messages.
  const form = createForm({
    schema: NewNote,
    initial: { text: "" },
    onSubmit: async (payload) => {
      await notesApi((client) => client.notes.create({ payload }))
      form.reset()
      await refetch()
    },
  })

  const remove = async (note: Note) => {
    await notesApi((client) => client.notes.delete({ params: { id: note.id } })).then(
      () => toast.success("Note deleted"),
      (cause: unknown) => toast.error("Could not delete the note", errorMessage(cause)),
    )
    await refetch()
  }

  return (
    <>
      <Show when={can(app.perm("notes.write"))}>
        <form class="compose" noValidate onSubmit={form.submit}>
          <TextareaField
            label="New note"
            placeholder="Write a note for the team"
            autoresize
            maxLength={500}
            {...form.field("text")}
          />
          <Show when={form.error()}>
            {(error) => (
              <p role="alert" class="error">
                {error()}
              </p>
            )}
          </Show>
          <Button type="submit" loading={form.submitting()}>
            Post
          </Button>
        </form>
      </Show>
      <For
        each={list() ?? []}
        fallback={<EmptyState title="No notes yet" description="Notes the team posts show here." />}
      >
        {(note) => (
          <Card.Root>
            <Card.Body gap="2">
              <p class="text">{note.text}</p>
              <footer class="meta">
                <span>
                  {note.author.name} · {new Date(note.createdAt.epochMilliseconds).toLocaleString()}
                </span>
                <Show when={note.author.id === principal()?.user?.id || can(app.perm("notes.delete"))}>
                  <Button variant="plain" size="xs" onClick={() => void remove(note)}>
                    Delete
                  </Button>
                </Show>
              </footer>
            </Card.Body>
          </Card.Root>
        )}
      </For>
    </>
  )
}

const App = () => (
  <ThemeProvider>
    <Header />
    <main class="main">
      <Show when={!session.loading}>
        <Show
          when={principal()?.can(app.accessPermission)}
          fallback={
            <EmptyState
              title={principal()?.user ? "You cannot read notes yet" : "Sign in to read the team's notes"}
              action={
                <Show
                  when={principal()?.user}
                  fallback={
                    <a class="link" href={standaloneLinks.signIn(here())}>
                      Sign in
                    </a>
                  }
                >
                  <a class="link" href={standaloneLinks.requestAccess(here())}>
                    Request access
                  </a>
                </Show>
              }
            />
          }
        >
          <NoteList />
        </Show>
      </Show>
    </main>
    <Toasts />
  </ThemeProvider>
)

const root = document.getElementById("root")
if (root === null) throw new Error("No #root element")
render(() => <App />, root)
