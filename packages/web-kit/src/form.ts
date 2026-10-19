import { errorMessage } from "@mosaik/client"
import { Schema } from "effect"
import { batch, createMemo, createSignal } from "solid-js"
import { createStore, reconcile } from "solid-js/store"

/** What a form edits: the Schema's encoded side, which is what inputs hold (strings, booleans, lists). */
type Values<S extends Schema.ConstraintDecoder<unknown>> = S["Encoded"] & object

/** Props for one input: spread them on `TextField`, `Select`, … (`{...form.field("email")}`). */
export interface FieldBinding<V> {
  readonly name: string
  readonly value: V
  readonly onValueChange: (value: V) => void
  readonly onBlur: () => void
  /** Shown once the field was left or a submit was tried. */
  readonly errorText: string | undefined
}

export interface FormOptions<S extends Schema.ConstraintDecoder<unknown>> {
  /** Usually the API's payload Schema, so the form checks exactly what the API will. */
  readonly schema: S
  readonly initial: Values<S>
  /** Gets the decoded value (for a `Schema.Class`, an instance: what the API client sends). */
  readonly onSubmit: (value: S["Type"]) => unknown
}

export interface Form<S extends Schema.ConstraintDecoder<unknown>> {
  readonly values: Values<S>
  field<K extends keyof Values<S> & string>(name: K): FieldBinding<Values<S>[K]>
  set<K extends keyof Values<S> & string>(name: K, value: Values<S>[K]): void
  /** For `<form onSubmit={form.submit}>`: validates, then calls `onSubmit` with the decoded value. */
  readonly submit: (event?: Event) => Promise<void>
  readonly submitting: () => boolean
  /** Why the last submit failed: the API's answer (e.g. a conflict), or a check without a field. */
  readonly error: () => string | undefined
  /** The first problem of each field, by name, whether shown yet or not. */
  readonly errors: () => Readonly<Record<string, string>>
  readonly valid: () => boolean
  /** Back to the initial values (or new ones), with nothing touched. */
  readonly reset: (values?: Values<S>) => void
}

/**
 * A plain copy of the store's values, read through the store so that whatever calls it
 * (the live check) runs again when a value changes.
 */
const snapshot = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(snapshot)
    : value !== null && typeof value === "object"
      ? Object.fromEntries(Object.keys(value).map((key) => [key, snapshot((value as Record<string, unknown>)[key])]))
      : value

/** Where an issue belongs: its first path segment (the field), or the form itself. */
const fieldOf = (path: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined): string => {
  const first = path?.[0]
  if (first === undefined) return ""
  return String(typeof first === "object" ? first.key : first)
}

/**
 * A form driven by a Schema, usually the one the API contract already has for the payload:
 * the same checks on both sides, and the value the API expects without converting by hand.
 *
 * @example
 * const form = createForm({
 *   schema: NewNote,
 *   initial: { text: "" },
 *   onSubmit: (note) => post.mutateAsync({ payload: note }),
 * })
 * // `noValidate`: the Schema's messages, not the browser's ("required" still marks the label).
 * <form noValidate onSubmit={form.submit}>
 *   <TextField label="Note" {...form.field("text")} />
 *   <Show when={form.error()}>{(error) => <p>{error()}</p>}</Show>
 *   <Button type="submit" loading={form.submitting()}>Post</Button>
 * </form>
 */
export const createForm = <S extends Schema.ConstraintDecoder<unknown>>(options: FormOptions<S>): Form<S> => {
  const standard = Schema.toStandardSchemaV1(options.schema, { parseOptions: { errors: "all" } })
  const [values, setValues] = createStore<Values<S>>(structuredClone(options.initial))
  const [touched, setTouched] = createSignal<ReadonlySet<string>>(new Set())
  const [tried, setTried] = createSignal(false)
  const [submitting, setSubmitting] = createSignal(false)
  const [error, setError] = createSignal<string>()

  const validate = (input: unknown) => standard["~standard"].validate(input)

  // Live checks are synchronous; a Schema with asynchronous parts is checked on submit only.
  const errors = createMemo((): Readonly<Record<string, string>> => {
    const result = validate(snapshot(values))
    if (result instanceof Promise || result.issues === undefined) return {}
    const found: Record<string, string> = {}
    for (const issue of result.issues) {
      const field = fieldOf(issue.path)
      if (!(field in found)) found[field] = issue.message
    }
    return found
  })

  const set = <K extends keyof Values<S> & string>(name: K, value: Values<S>[K]) => {
    // Typed keys of a generic store are beyond TypeScript; the signature above keeps callers checked.
    ;(setValues as (key: string, value: unknown) => void)(name, value)
    setError(undefined)
  }

  return {
    values,
    set,

    field: (name) => ({
      name,
      get value() {
        return values[name]
      },
      onValueChange: (value) => set(name, value),
      onBlur: () => setTouched((previous) => new Set(previous).add(name)),
      get errorText() {
        return tried() || touched().has(name) ? errors()[name] : undefined
      },
    }),

    submit: async (event) => {
      event?.preventDefault()
      if (submitting()) return
      setTried(true)
      setError(undefined)
      const result = await validate(snapshot(values))
      if (result.issues !== undefined) {
        // Field problems show on their fields; one that belongs to no field shows on the form.
        const general = result.issues.find((issue) => fieldOf(issue.path) === "")
        if (general !== undefined) setError(general.message)
        return
      }
      setSubmitting(true)
      try {
        await options.onSubmit(result.value)
      } catch (cause) {
        setError(errorMessage(cause))
      } finally {
        setSubmitting(false)
      }
    },

    submitting,
    error,
    errors,
    valid: () => Object.keys(errors()).length === 0,

    reset: (next) =>
      batch(() => {
        setValues(reconcile(structuredClone(next ?? options.initial)))
        setTouched(new Set<string>())
        setTried(false)
        setError(undefined)
      }),
  }
}
