import { useNavigate, useSearch } from "@tanstack/solid-router"
import type { Schema } from "effect"
import { type Accessor, createMemo } from "solid-js"
import { type SearchOf, searchValidator } from "./search"

/**
 * Typed search params for a page that cannot import its route: installed apps create their
 * routes at runtime (`defineWebApp`). The route validates them with `searchValidator(schema)`;
 * the page reads them back with the same schema, and writes them for the current page.
 *
 * @example
 * const [search, setSearch] = useSearchParams(OrdersSearch)
 * setSearch((previous) => ({ ...previous, status: "paid" }))
 */
export const useSearchParams = <S extends Schema.Struct<Schema.Struct.Fields>>(
  schema: S,
): readonly [
  Accessor<SearchOf<S>>,
  (update: (previous: SearchOf<S>) => SearchOf<S>, options?: { readonly replace?: boolean }) => void,
] => {
  const { validate } = searchValidator(schema)["~standard"]
  const raw = useSearch({ strict: false })
  const navigate = useNavigate()
  const search = createMemo(() => validate(raw()).value)
  const setSearch = (update: (previous: SearchOf<S>) => SearchOf<S>, options: { readonly replace?: boolean } = {}) =>
    void navigate({ to: ".", search: update(search()), replace: options.replace ?? false })
  return [search, setSearch]
}
