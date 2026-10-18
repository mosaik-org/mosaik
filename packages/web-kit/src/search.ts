import { Option, Schema } from "effect"

/** Search params as the router sees them (plain, mutable object type). */
export type SearchOf<S extends Schema.Top> = { -readonly [K in keyof S["Type"]]: S["Type"][K] }

/** The Standard Schema shape TanStack Router understands for `validateSearch`. */
export interface SearchValidator<Output> {
  readonly "~standard": {
    readonly version: 1
    readonly vendor: "mosaik"
    readonly validate: (value: unknown) => { readonly value: Output }
    readonly types: { readonly input: Partial<Output>; readonly output: Output }
  }
}

/**
 * Builds a TanStack Router `validateSearch` from an Effect Schema struct.
 *
 * Lenient on purpose: a malformed or outdated parameter (e.g. from an old bookmark)
 * is dropped instead of failing the whole page. Only valid fields are kept.
 */
export const searchValidator = <S extends Schema.Struct<Schema.Struct.Fields>>(
  schema: S,
): SearchValidator<SearchOf<S>> => {
  const decoders = Object.entries(schema.fields).map(([key, field]) => {
    // Search param schemas never need services; the cast only erases that in the type.
    const struct = Schema.Struct({ [key]: field }) as unknown as Schema.Codec<Record<string, unknown>>
    return [key, Schema.decodeUnknownOption(struct)] as const
  })

  const validate = (value: unknown) => {
    const raw = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const [key, decode] of decoders) {
      const input = raw[key]
      if (input === undefined) continue
      // The router parses `?q=123` as a number; retry as text for string fields.
      const decoded = decode({ [key]: input }).pipe(
        Option.orElse(() => (typeof input === "string" ? Option.none() : decode({ [key]: String(input) }))),
      )
      if (Option.isSome(decoded) && decoded.value[key] !== undefined) result[key] = decoded.value[key]
    }
    return { value: result as SearchOf<S> }
  }

  return { "~standard": { version: 1, vendor: "mosaik", validate, types: undefined as never } }
}
