import { UpstreamError } from "@mosaik/core"
import { Cause, Schema } from "effect"
import { HttpClientError } from "effect/http"

export const ConnectorErrorReason = Schema.Literals([
  /** Credentials are missing, wrong or lack access (401/403). */
  "Unauthorized",
  "NotFound",
  /** Rate limit still exceeded after the automatic retries (429). */
  "RateLimited",
  /** The request was rejected as invalid (other 4xx). */
  "BadRequest",
  /** Network failure, timeout or a 5xx response, after the automatic retries. */
  "Unavailable",
  /** The response did not match the expected schema. */
  "InvalidResponse",
])
export type ConnectorErrorReason = typeof ConnectorErrorReason.Type

/** A request to an external system failed. */
export class ConnectorError extends Schema.TaggedError<ConnectorError>()("ConnectorError", {
  connector: Schema.String,
  reason: ConnectorErrorReason,
  status: Schema.optional(Schema.Number),
  message: Schema.String,
}) {
  /** For API handlers: report the failure as a 502 without leaking internals. */
  toUpstreamError(): UpstreamError {
    return new UpstreamError({ source: this.connector, message: `${this.connector} request failed: ${this.reason}` })
  }
}

const reasonForStatus = (status: number): ConnectorErrorReason =>
  status === 401 || status === 403
    ? "Unauthorized"
    : status === 404
      ? "NotFound"
      : status === 429
        ? "RateLimited"
        : status >= 500
          ? "Unavailable"
          : "BadRequest"

/** Maps HTTP client, schema and timeout failures to a {@link ConnectorError}. */
export const toConnectorError =
  (connector: string) =>
  (error: unknown): ConnectorError => {
    if (error instanceof ConnectorError) return error
    if (HttpClientError.isHttpClientError(error)) {
      const status = error.response?.status
      if (status !== undefined) {
        return new ConnectorError({ connector, reason: reasonForStatus(status), status, message: error.message })
      }
      const invalid = error.reason._tag === "DecodeError" || error.reason._tag === "EmptyBodyError"
      return new ConnectorError({
        connector,
        reason: invalid ? "InvalidResponse" : "Unavailable",
        message: error.message,
      })
    }
    if (Schema.isSchemaError(error)) {
      return new ConnectorError({ connector, reason: "InvalidResponse", message: error.message })
    }
    if (Cause.isTimeoutError(error)) {
      return new ConnectorError({ connector, reason: "Unavailable", message: "Request timed out" })
    }
    return new ConnectorError({ connector, reason: "Unavailable", message: String(error) })
  }
