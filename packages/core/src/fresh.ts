import { DateTime, Schema } from "effect"

/**
 * Wraps API data whose source is older than the response, e.g. a cached aggregate,
 * a warehouse table filled by a nightly job, or an external API behind a cache.
 * The UI shows `asOf` instead of the time the browser fetched the response.
 *
 * @example
 * HttpApiEndpoint.get("summary", "/summary", { success: Fresh(SalesSummary) })
 */
export const Fresh = <S extends Schema.Top>(data: S) =>
  Schema.Struct({
    data,
    /** When the underlying data was produced. */
    asOf: Schema.DateTimeUtc,
    /** Human-readable origin, e.g. "orders database (cached)" or "Jira". */
    source: Schema.String,
  })

export interface Fresh<A> {
  readonly data: A
  readonly asOf: DateTime.Utc
  readonly source: string
}

export const fresh = <A>(data: A, asOf: DateTime.Utc, source: string): Fresh<A> => ({ data, asOf, source })

/** Whether a value looks like a {@link Fresh} envelope (used by generic UI). */
export const isFresh = (value: unknown): value is Fresh<unknown> =>
  typeof value === "object" && value !== null && "asOf" in value && DateTime.isDateTime(value.asOf)
