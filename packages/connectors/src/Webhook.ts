import { Duration, Effect, Redacted, Schedule } from "effect"
import { HttpClient, HttpClientRequest } from "effect/http"
import { ConnectorError, toConnectorError } from "./ConnectorError"

/**
 * POSTs a JSON body to a URL that carries its own credentials (Slack incoming webhooks,
 * Teams workflows), with a timeout and retries of transient failures. Resolves with the
 * response text. The URL is a secret: it never appears in errors or traces.
 */
export const post = Effect.fn("Webhook.post")(function* (name: string, url: Redacted.Redacted<string>, body: unknown) {
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.filterStatusOk,
    HttpClient.retryTransient({ times: 2, schedule: Schedule.exponential("250 millis").pipe(Schedule.jittered) }),
  )
  const request = HttpClientRequest.post(Redacted.value(url)).pipe(
    HttpClientRequest.acceptJson,
    HttpClientRequest.bodyJsonUnsafe(body),
  )
  return yield* client.execute(request).pipe(
    Effect.flatMap((response) => response.text),
    // The client's own span would record the URL; ours below does not.
    Effect.provideService(HttpClient.TracerDisabledWhen, () => true),
    Effect.timeout(Duration.seconds(15)),
    Effect.mapError((error) => {
      const mapped = toConnectorError(name)(error)
      // HTTP client errors include the request URL, which is the secret: keep only the outcome.
      return new ConnectorError({
        connector: name,
        reason: mapped.reason,
        ...(mapped.status === undefined ? {} : { status: mapped.status }),
        message: mapped.status === undefined ? `${name} webhook ${mapped.reason}` : `HTTP ${mapped.status}`,
      })
    }),
    Effect.withSpan(`${name} webhook`, { attributes: { "connector.name": name } }),
  )
})
