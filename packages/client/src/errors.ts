import { Predicate } from "effect"

/** `_tag` of a typed API error (`Unauthorized`, `Forbidden`, `NotFound`, ...), if any. */
export const errorTag = (error: unknown): string | undefined =>
  Predicate.hasProperty(error, "_tag") && Predicate.isString(error._tag) ? error._tag : undefined

/** Errors that will not go away by retrying the same request. */
const PERMANENT = new Set(["Unauthorized", "Forbidden", "NotFound", "BadRequest", "Conflict"])

export const isPermanentError = (error: unknown): boolean => PERMANENT.has(errorTag(error) ?? "")

/** A message suitable for showing to users. */
export const errorMessage = (error: unknown): string => {
  switch (errorTag(error)) {
    case "Unauthorized":
      return "Please log in to continue."
    case "Forbidden":
      return "You don't have permission to do this."
    case "ServiceUnavailable":
      return "The service is unavailable. Please try again shortly."
  }
  if (Predicate.hasProperty(error, "message") && Predicate.isString(error.message) && error.message.length > 0) {
    return error.message
  }
  return "Unexpected error"
}
