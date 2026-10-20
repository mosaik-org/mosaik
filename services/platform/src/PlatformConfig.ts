import { Config, Context, Duration, Effect, Layer, Option, type Redacted } from "effect"

/** An app the configuration names, and where it runs. */
export interface ConfiguredApp {
  readonly id: string
  readonly url: string
}

/** Parses an app list such as `CONFIGURED_APPS=status=http://status:3000,sales=http://sales:3000`. */
export const parseAppList = (variable: string, raw: string): ReadonlyArray<ConfiguredApp> =>
  raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const separator = entry.indexOf("=")
      const id = entry.slice(0, separator)
      const url = entry.slice(separator + 1)
      if (separator <= 0 || !/^[a-z][a-z0-9-]*$/.test(id)) throw new Error(`Invalid ${variable} entry "${entry}"`)
      return { id, url: new URL(url).toString() }
    })

/** Postgres access to provision databases for apps. */
export interface DatabaseAdmin {
  /** A superuser connection (`POSTGRES_URL`). */
  readonly url: Redacted.Redacted<string>
  /** Database passwords are derived from it (`DB_PASSWORD_SECRET`). */
  readonly passwordSecret: Redacted.Redacted<string>
  /** The server as apps reach it (`APP_DB_SERVER_URL`), in the URLs handed out. */
  readonly appServerUrl: string
}

/** Where apps' files are kept: an S3 service (SeaweedFS), one bucket, a folder per app. */
export interface StorageConfig {
  readonly url: string
  readonly bucket: string
  readonly accessKeyId: string
  readonly secretAccessKey: Redacted.Redacted<string>
  /** What each app may store unless an admin sets its own limit (`STORAGE_DEFAULT_LIMIT_GB`, 5). */
  readonly defaultLimitBytes: number
}

const nonEmpty = (name: string) =>
  Config.String(name).pipe(Config.option, Config.map(Option.filter((value) => value.length > 0)))

/** Platform service configuration, read from the environment. */
export class PlatformConfig extends Context.Service<
  PlatformConfig,
  {
    /**
     * Apps the configuration names, and where they run (`CONFIGURED_APPS`): built-in apps with a
     * backend, the examples in development, and standalone apps without the Portal. Their keys
     * are derived from `INTERNAL_KEY`.
     */
    readonly configuredApps: ReadonlyArray<ConfiguredApp>
    readonly internalKey: Redacted.Redacted<string>
    /** Without it, apps bring their own databases. */
    readonly databaseAdmin: Option.Option<DatabaseAdmin>
    /** How long platform events are kept for subscribers that have not processed them (`EVENT_RETENTION_DAYS`, 30). */
    readonly eventRetention: Duration.Duration
    /** Without `STORAGE_URL`, apps cannot store files. */
    readonly storage: Option.Option<StorageConfig>
  }
>()("@mosaik/platform-service/PlatformConfig") {
  static readonly layer = Layer.effect(
    PlatformConfig,
    Effect.gen(function* () {
      const configuredApps = yield* Effect.flatMap(
        Config.String("CONFIGURED_APPS").pipe(Config.withDefault("")),
        (raw) => Effect.try({ try: () => parseAppList("CONFIGURED_APPS", raw), catch: (error) => error as Error }),
      )
      const admin = yield* Config.all({
        url: Config.Redacted("POSTGRES_URL"),
        passwordSecret: Config.Redacted("DB_PASSWORD_SECRET"),
      }).pipe(Config.option)
      const appServerUrl = yield* nonEmpty("APP_DB_SERVER_URL")
      const databaseAdmin = Option.zipWith(admin, appServerUrl, (admin, appServerUrl) => ({ ...admin, appServerUrl }))
      const storageUrl = yield* nonEmpty("STORAGE_URL")
      const storage = Option.isNone(storageUrl)
        ? Option.none<StorageConfig>()
        : Option.some({
            url: storageUrl.value,
            bucket: yield* Config.String("STORAGE_BUCKET").pipe(Config.withDefault("mosaik")),
            accessKeyId: yield* Config.String("STORAGE_ACCESS_KEY_ID"),
            secretAccessKey: yield* Config.Redacted("STORAGE_SECRET_ACCESS_KEY"),
            defaultLimitBytes: Math.round(
              (yield* Config.Number("STORAGE_DEFAULT_LIMIT_GB").pipe(Config.withDefault(5))) * 1024 ** 3,
            ),
          })
      return PlatformConfig.of({
        configuredApps,
        internalKey: yield* Config.Redacted("INTERNAL_KEY"),
        databaseAdmin,
        eventRetention: Duration.days(
          Math.max(1, yield* Config.Int("EVENT_RETENTION_DAYS").pipe(Config.withDefault(30))),
        ),
        storage,
      })
    }),
  )
}
