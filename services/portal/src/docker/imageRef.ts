/** A Docker image reference, e.g. `registry.example.com/team/crm:1.4.2` or `crm@sha256:…`. */
export interface ImageRef {
  /** Registry host; `null` for Docker Hub. */
  readonly registry: string | null
  /** Repository with its registry, e.g. `registry.example.com/team/crm`. */
  readonly name: string
  readonly tag: string | null
  readonly digest: string | null
}

export const parseImageRef = (ref: string): ImageRef => {
  const at = ref.indexOf("@")
  const digest = at === -1 ? null : ref.slice(at + 1)
  const rest = at === -1 ? ref : ref.slice(0, at)
  const lastSlash = rest.lastIndexOf("/")
  const colon = rest.lastIndexOf(":")
  const hasTag = colon > lastSlash
  const name = hasTag ? rest.slice(0, colon) : rest
  const tag = hasTag ? rest.slice(colon + 1) : digest === null ? "latest" : null
  const first = name.split("/")[0] ?? ""
  const registry =
    name.includes("/") && (first.includes(".") || first.includes(":") || first === "localhost") ? first : null
  if (name.length === 0 || /\s/.test(ref)) throw new Error(`Invalid image reference "${ref}"`)
  return { registry, name, tag, digest }
}

/** The reference in its canonical form, e.g. `crm:latest`. */
export const formatImageRef = (ref: ImageRef): string =>
  `${ref.name}${ref.tag === null ? "" : `:${ref.tag}`}${ref.digest === null ? "" : `@${ref.digest}`}`
