import { Config, Context, Effect, Layer, Option, type Redacted } from "effect"

/** Where the model runs. More will follow; each is one case in `Model`. OpenCode's two plans share a key and differ in endpoint and terms. */
export type Provider = "opencode" | "opencode-go" | "anthropic" | "bedrock"

/** The model the assistant uses, and how to reach it. */
export type ModelSettings =
  | {
      /** OpenCode Zen (pay as you go) or OpenCode Go (a subscription). */
      readonly provider: "opencode" | "opencode-go"
      readonly model: string
      readonly apiKey: Redacted.Redacted<string>
      /** The plan's OpenAI-compatible endpoint, which serves all its text models. */
      readonly baseUrl: string
    }
  | { readonly provider: "anthropic"; readonly model: string; readonly apiKey: Redacted.Redacted<string> }
  | {
      readonly provider: "bedrock"
      readonly model: string
      /** Credentials come from the usual AWS variables (`AWS_ACCESS_KEY_ID`, …, or `AWS_BEARER_TOKEN_BEDROCK`). */
      readonly region: string
    }

const OPENCODE_BASE_URLS = {
  opencode: "https://opencode.ai/inference/openai/v1",
  "opencode-go": "https://opencode.ai/inference/go/openai/v1",
} as const

const settings = Effect.gen(function* () {
  // Unset or empty (as compose passes an unset variable): off.
  const configured = yield* Config.String("ASSISTANT_PROVIDER").pipe(Config.withDefault(""))
  if (configured.trim() === "") return Option.none<ModelSettings>()
  const provider = yield* Config.Literals(["opencode", "opencode-go", "anthropic", "bedrock"], "ASSISTANT_PROVIDER")
  const model = yield* Config.String("ASSISTANT_MODEL")
  switch (provider) {
    case "opencode":
    case "opencode-go":
      return Option.some<ModelSettings>({
        provider,
        model,
        apiKey: yield* Config.Redacted("OPENCODE_API_KEY"),
        baseUrl: yield* Config.String("OPENCODE_BASE_URL").pipe(Config.withDefault(OPENCODE_BASE_URLS[provider])),
      })
    case "anthropic":
      return Option.some<ModelSettings>({
        provider: "anthropic",
        model,
        apiKey: yield* Config.Redacted("ANTHROPIC_API_KEY"),
      })
    case "bedrock":
      return Option.some<ModelSettings>({ provider: "bedrock", model, region: yield* Config.String("AWS_REGION") })
  }
}).pipe(Effect.map((settings): Option.Option<ModelSettings> => settings))

/**
 * The assistant's settings, from the environment. Without `ASSISTANT_PROVIDER` the assistant is
 * off: it sends company data to a model provider, so an admin chooses one deliberately.
 */
export class AssistantConfig extends Context.Service<
  AssistantConfig,
  {
    readonly model: Option.Option<ModelSettings>
    /** The company's name for Mosaik, which the assistant uses for itself. */
    readonly brand: string
    /** Who acts, in apps' audit logs: "<brand> assistant". */
    readonly agentName: string
  }
>()("@mosaik/assistant-service/AssistantConfig") {
  static readonly layer = Layer.effect(
    AssistantConfig,
    Effect.gen(function* () {
      const brand = yield* Config.String("BRAND_NAME").pipe(Config.withDefault("Mosaik"))
      return AssistantConfig.of({ model: yield* settings, brand, agentName: `${brand} assistant` })
    }),
  )
}
