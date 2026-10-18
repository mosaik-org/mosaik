import { AuthError, sessionQueryOptions, signInWithMicrosoft, signInWithPassword, useSession } from "@mosaik/auth/web"
import { css } from "@mosaik/styled-system/css"
import { Button, Card, Divider, TextField, ThemeToggle } from "@mosaik/ui"
import { useQueryClient } from "@tanstack/solid-query"
import { createFileRoute, useRouter } from "@tanstack/solid-router"
import { createSignal, Show } from "solid-js"

interface LoginSearch {
  readonly redirect?: string
  readonly error?: string
}

/** Only same-origin paths are valid redirect targets (no open redirects). */
const safeRedirect = (value: unknown): string | undefined =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : undefined

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: safeRedirect(search.redirect),
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: Login,
})

const styles = {
  page: css({ minHeight: "100dvh", display: "grid", placeItems: "center", px: "4", bg: "bg.subtle" }),
  card: css({ width: "full", maxWidth: "sm", display: "flex", flexDirection: "column", gap: "5" }),
  logo: css({
    display: "grid",
    placeItems: "center",
    width: "10",
    height: "10",
    borderRadius: "lg",
    bg: "accent.default",
    color: "accent.fg",
    fontWeight: "bold",
  }),
  error: css({ px: "3", py: "2", borderRadius: "md", bg: "danger.subtle", color: "danger.text", fontSize: "sm" }),
}

function Login() {
  const search = Route.useSearch()
  const router = useRouter()
  const queryClient = useQueryClient()
  const session = useSession()

  const [email, setEmail] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [pending, setPending] = createSignal(false)
  const [error, setError] = createSignal(
    search().error === "sso" ? "Single sign-on failed. Please try again." : undefined,
  )

  const destination = () => search().redirect ?? "/"

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    setPending(true)
    setError(undefined)
    try {
      await signInWithPassword(email(), password())
      // Cached data belongs to the anonymous principal; start fresh.
      queryClient.clear()
      await queryClient.fetchQuery(sessionQueryOptions())
      router.history.push(destination())
    } catch (cause) {
      setError(cause instanceof AuthError ? cause.message : "Could not sign in. Please try again.")
    } finally {
      setPending(false)
    }
  }

  const microsoft = async () => {
    setError(undefined)
    try {
      await signInWithMicrosoft(destination())
    } catch {
      setError("Could not start single sign-on.")
    }
  }

  return (
    <div class={styles.page}>
      <div class={css({ position: "fixed", top: "4", right: "4" })}>
        <ThemeToggle />
      </div>
      <Card class={styles.card}>
        <div class={css({ display: "flex", flexDirection: "column", gap: "3" })}>
          <div class={styles.logo}>M</div>
          <div>
            <h1 class={css({ fontSize: "xl", fontWeight: "semibold" })}>Sign in to Mosaik</h1>
            <p class={css({ color: "fg.muted" })}>Use your company account or email.</p>
          </div>
        </div>

        <Show when={error()}>{(message) => <div class={styles.error}>{message()}</div>}</Show>

        <Show when={session.data?.providers.microsoft}>
          <Button variant="outline" onClick={() => void microsoft()}>
            <MicrosoftLogo />
            Sign in with Microsoft
          </Button>
          <Divider label="or" />
        </Show>

        <form class={css({ display: "flex", flexDirection: "column", gap: "4" })} onSubmit={(e) => void submit(e)}>
          <TextField
            label="Email"
            type="email"
            autocomplete="email"
            required
            value={email()}
            onValueChange={setEmail}
          />
          <TextField
            label="Password"
            type="password"
            autocomplete="current-password"
            required
            value={password()}
            onValueChange={setPassword}
          />
          <Button type="submit" loading={pending()}>
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  )
}

const MicrosoftLogo = () => (
  <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
)
