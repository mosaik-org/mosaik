/**
 * What a call is given, as people read it: each value under the names the app gave them
 * (`path.id` and `body.reason` as "id" and "reason").
 */
export const inputFields = (input: unknown): ReadonlyArray<readonly [string, string]> => {
  const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)
  if (!isObject(input)) return []
  return Object.values(input).flatMap((group) =>
    isObject(group)
      ? Object.entries(group).map(
          ([name, value]) => [name, typeof value === "string" ? value : JSON.stringify(value)] as const,
        )
      : [],
  )
}
