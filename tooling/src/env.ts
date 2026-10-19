import { derivedAppKey } from "@mosaik/platform/server"
import { Redacted } from "effect"
import type { AppPackage } from "./workspace"

/**
 * Development defaults. Anything set in `.env` (auto-loaded by Bun) or the shell wins.
 * Never use these values in production.
 */
const DEV_DEFAULTS = {
  POSTGRES_URL: "postgres://postgres:postgres@localhost:5432/postgres",
  DB_PASSWORD_SECRET: "dev-db-password-secret",
  AUTH_SECRET: "dev-auth-secret-0123456789abcdef0123456789",
  INTERNAL_KEY: "dev-internal-key",
  PUBLIC_URL: "http://localhost:5173",
  ADMIN_EMAIL: "admin@mosaik.local",
  ADMIN_PASSWORD: "admin12345",
  // Mailpit from `bun infra:up` (inbox at http://localhost:8025).
  SMTP_URL: "smtp://localhost:1025",
  MAIL_FROM: "Mosaik <mosaik@mosaik.local>",
  MAIL_ALLOWED_DOMAINS: "*",
} as const

export const env = (name: keyof typeof DEV_DEFAULTS): string => process.env[name] || DEV_DEFAULTS[name]

export const PORTS = {
  web: 5173,
  gateway: 3000,
  auth: 4000,
  notifications: 4001,
  platform: 4002,
  portal: 4003,
  firstApp: 4100,
  firstExample: 4300,
} as const

export const AUTH_URL = `http://localhost:${PORTS.auth}`
export const NOTIFICATIONS_URL = `http://localhost:${PORTS.notifications}`
export const PLATFORM_URL = `http://localhost:${PORTS.platform}`
export const PORTAL_URL = `http://localhost:${PORTS.portal}`

/** Services connect to their own database on this server; credentials are derived per service. */
const database = (serviceId: string): Record<string, string> => {
  const server = new URL(env("POSTGRES_URL"))
  server.username = ""
  server.password = ""
  server.pathname = ""
  const override = process.env[`DATABASE_URL_${upper(serviceId)}`]
  return {
    DB_SERVER_URL: server.toString(),
    DB_PASSWORD_SECRET: env("DB_PASSWORD_SECRET"),
    ...(override ? { DATABASE_URL: override } : {}),
  }
}

export interface ServicePlan {
  readonly name: string
  readonly cwd: string
  readonly cmd: ReadonlyArray<string>
  readonly env: Record<string, string>
  readonly port: number
}

const common = (): Record<string, string> => ({
  NODE_ENV: "development",
  // How Core's own pages (sign-in, requesting access, notification settings) look.
  ...pick("BRAND_NAME", "BRAND_LOGO_URL", "BRAND_COLOR"),
  PLATFORM_URL,
  // Platform services authenticate each other with it; built-in apps derive their app key from it.
  INTERNAL_KEY: env("INTERNAL_KEY"),
  ...(process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? { OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT }
    : {}),
})

/** Platform services also talk to each other directly. */
const shared = (): Record<string, string> => ({ ...common(), AUTH_URL, NOTIFICATIONS_URL })

export interface PlanOptions {
  /**
   * Core alone (`bun dev --headless`): its services, the gateway, the console and the standalone
   * examples, without the Portal, the shell or the built-in apps.
   */
  readonly headless?: boolean
}

/**
 * What `bun dev` runs: Core's services (auth, notifications, platform), the Portal, every
 * built-in app's backend, the examples, the gateway and Vite.
 */
export const planServices = (
  root: string,
  apps: ReadonlyArray<AppPackage>,
  examples: ReadonlyArray<AppPackage>,
  options: PlanOptions = {},
): Array<ServicePlan> => {
  const headless = options.headless ?? false
  // Where people's browsers reach Core: Vite, serving the shell or the console and proxying `/api` to the gateway.
  const coreUrl = env("PUBLIC_URL")
  const backends = headless ? [] : apps.filter((d) => d.entrypoint !== null)

  const appPlans = backends.map((app, index): ServicePlan => {
    const port = PORTS.firstApp + index
    return {
      name: app.manifest.id,
      cwd: app.dir,
      cmd: ["bun", "--watch", "server/main.ts"],
      port,
      // Apps only know the platform API: no direct access to platform services.
      env: {
        ...common(),
        PORT: String(port),
        ...(app.manifest.database ? database(app.manifest.id) : {}),
      },
    }
  })

  // Examples run like a team's app hosted elsewhere: its own dev loop (`bun run dev`), and only the
  // platform API with its key. Core knows them from its configuration (`CONFIGURED_APPS`) and derives the key.
  // Standalone examples serve their own page on their port and sign people in through Core.
  const examplePlans = examples
    .filter((example) => !headless || example.standalone)
    .map((example, index): ServicePlan => {
      const port = PORTS.firstExample + index
      return {
        name: example.manifest.id,
        cwd: example.dir,
        cmd: ["bun", "run", "dev"],
        port,
        env: {
          NODE_ENV: "development",
          PLATFORM_URL,
          PORT: String(port),
          MOSAIK_APP_KEY: Redacted.value(derivedAppKey(Redacted.make(env("INTERNAL_KEY")), example.manifest.id)),
          ...(process.env.OTEL_EXPORTER_OTLP_ENDPOINT
            ? { OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT }
            : {}),
          ...(example.manifest.database ? database(example.manifest.id) : {}),
          ...(example.standalone ? { MOSAIK_PUBLIC_URL: `http://localhost:${port}`, MOSAIK_URL: coreUrl } : {}),
        },
      }
    })

  // Service discovery for apps that call sibling services (e.g. the status app).
  const services = [
    `gateway=http://localhost:${PORTS.gateway}`,
    `auth=${AUTH_URL}`,
    `notifications=${NOTIFICATIONS_URL}`,
    `platform=${PLATFORM_URL}`,
    `portal=${PORTAL_URL}`,
    ...appPlans.map((plan) => `${plan.name}=http://localhost:${plan.port}`),
  ].join(",")
  for (const plan of appPlans) plan.env.MOSAIK_SERVICES = services

  // The gateway routes platform services from its environment and apps from the platform's registry.
  const upstreams = {
    UPSTREAM_AUTH: AUTH_URL,
    UPSTREAM_ADMIN: AUTH_URL,
    UPSTREAM_NOTIFICATIONS: NOTIFICATIONS_URL,
    UPSTREAM_PLATFORM: PLATFORM_URL,
    ...(headless ? {} : { UPSTREAM_PORTAL: PORTAL_URL }),
  }
  const configuredApps = [...appPlans, ...examplePlans]
    .map((plan) => `${plan.name}=http://localhost:${plan.port}`)
    .join(",")

  const portalPlan: ServicePlan = {
    name: "portal",
    cwd: `${root}/services/portal`,
    cmd: ["bun", "--watch", "src/main.ts"],
    port: PORTS.portal,
    env: {
      ...shared(),
      PORT: String(PORTS.portal),
      ...database("portal"),
      // Image apps: the Portal runs on the host, containers reach the platform API through it.
      APP_ADDRESSING: "host",
      APP_PLATFORM_URL: `http://host.docker.internal:${PORTS.platform}`,
      ...(process.env.OTEL_EXPORTER_OTLP_ENDPOINT
        ? { APP_OTEL_EXPORTER_OTLP_ENDPOINT: fromContainers(process.env.OTEL_EXPORTER_OTLP_ENDPOINT) }
        : {}),
      ...pick("DOCKER_SOCKET", "DOCKER_NETWORK"),
    },
  }
  const webPlan: ServicePlan = {
    name: headless ? "console" : "web",
    // The Portal's shell, or Core's console without it: the same address, so Core's links work either way.
    cwd: `${root}/${headless ? "console" : "shell"}`,
    cmd: ["bun", "--bun", "vite", "--port", String(PORTS.web), "--strictPort"],
    port: PORTS.web,
    env: { GATEWAY_URL: `http://localhost:${PORTS.gateway}` },
  }

  return [
    {
      name: "auth",
      cwd: `${root}/services/auth`,
      cmd: ["bun", "--watch", "src/main.ts"],
      port: PORTS.auth,
      env: {
        ...shared(),
        PORT: String(PORTS.auth),
        ...database("auth"),
        PUBLIC_URL: coreUrl,
        AUTH_SECRET: env("AUTH_SECRET"),
        ADMIN_EMAIL: env("ADMIN_EMAIL"),
        ADMIN_PASSWORD: env("ADMIN_PASSWORD"),
        ...pick("ENTRA_CLIENT_ID", "ENTRA_CLIENT_SECRET", "ENTRA_TENANT_ID", "ENTRA_ALLOW_SIGNUP"),
      },
    },
    {
      name: "notifications",
      cwd: `${root}/services/notifications`,
      cmd: ["bun", "--watch", "src/main.ts"],
      port: PORTS.notifications,
      env: {
        ...shared(),
        PORT: String(PORTS.notifications),
        ...database("notifications"),
        PUBLIC_URL: coreUrl,
        SMTP_URL: env("SMTP_URL"),
        MAIL_FROM: env("MAIL_FROM"),
        MAIL_ALLOWED_DOMAINS: env("MAIL_ALLOWED_DOMAINS"),
        ...pick("MESSAGES_PER_MINUTE", "DELIVERY_MAX_ATTEMPTS", "SLACK_BOT_TOKEN", "SLACK_API_URL"),
      },
    },
    {
      name: "platform",
      cwd: `${root}/services/platform`,
      cmd: ["bun", "--watch", "src/main.ts"],
      port: PORTS.platform,
      env: {
        ...shared(),
        PORT: String(PORTS.platform),
        ...database("platform"),
        CONFIGURED_APPS: configuredApps,
        // Databases for apps; the ones it hands out are for containers, which reach Postgres through the host.
        POSTGRES_URL: env("POSTGRES_URL"),
        APP_DB_SERVER_URL: fromContainers(env("POSTGRES_URL"), { credentials: false }),
      },
    },
    ...(headless ? [] : [portalPlan]),
    ...appPlans,
    ...examplePlans,
    {
      name: "gateway",
      cwd: `${root}/services/gateway`,
      cmd: ["bun", "--watch", "src/main.ts"],
      port: PORTS.gateway,
      env: { ...shared(), PORT: String(PORTS.gateway), ...upstreams },
    },
    webPlan,
  ]
}

const upper = (id: string) => id.toUpperCase().replaceAll("-", "_")

/** A URL on this machine as containers see it (`localhost` → `host.docker.internal`). */
const fromContainers = (value: string, options: { readonly credentials?: boolean } = {}) => {
  const url = new URL(value)
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) url.hostname = "host.docker.internal"
  if (options.credentials === false) {
    url.username = ""
    url.password = ""
    url.pathname = ""
  }
  return url.toString().replace(/\/$/, "")
}

const pick = (...names: ReadonlyArray<string>): Record<string, string> =>
  Object.fromEntries(names.flatMap((name) => (process.env[name] ? [[name, process.env[name]]] : [])))
