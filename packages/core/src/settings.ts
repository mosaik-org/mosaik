import { Schema } from "effect"

/**
 * Settings: how an app behaves, changed by its owners and admins while it runs (a limit, a text,
 * a switch). Declared in the manifest, stored by the platform, read live by the app (`Settings`
 * in `@mosaik/server`). Not for where things are or secrets: those are `config`, set when the app
 * is installed.
 *
 * Every setting has a default, so an app works before anyone changes it. Declarations are plain
 * data: they travel in the manifest, and any page renders the form from them.
 */
interface SettingBase<Kind extends string, Value> {
  readonly kind: Kind
  /** What the form shows, e.g. "Largest refund". */
  readonly label: string
  /** Shown under the field: what changes, and when to change it. */
  readonly description?: string
  readonly default: Value
}

export interface TextSetting extends SettingBase<"text", string> {
  /** A longer text, several lines. */
  readonly multiline?: boolean
  readonly maxLength?: number
  /** `url`: an http(s) address. */
  readonly format?: "url"
}

export interface NumberSetting extends SettingBase<"number", number> {
  readonly min?: number
  readonly max?: number
  /** Whole numbers only. */
  readonly integer?: boolean
  /** Shown next to the field, e.g. `EUR` or `days`. */
  readonly unit?: string
}

export interface BooleanSetting extends SettingBase<"boolean", boolean> {}

export interface ChoiceSetting<Value extends string = string> extends SettingBase<"choice", Value> {
  /** The values, each with its label: `{ emea: "EMEA", na: "North America" }`. */
  readonly options: { readonly [K in Value]: string }
}

export type Setting = TextSetting | NumberSetting | BooleanSetting | ChoiceSetting

/** An app's settings, by name (`refundLimit`). */
export type SettingsSpec = { readonly [name: string]: Setting }

/** The settings of an app that declares none. */
export type NoSettings = Record<never, never>

/** The value a setting holds: `number` for a number setting, the option's value for a choice. */
export type SettingValue<S extends Setting> =
  S extends ChoiceSetting<infer V> ? V : S extends NumberSetting ? number : S extends BooleanSetting ? boolean : string

/** The values of an app's settings, by name. */
export type SettingValues<S extends SettingsSpec> = { readonly [K in keyof S]: SettingValue<S[K]> }

type Declare<S extends Setting> = Omit<S, "kind">

/**
 * Declares an app's settings (`settings` in `defineApp`).
 *
 * @example
 * settings: {
 *   refundLimit: Setting.number({ label: "Largest refund", unit: "EUR", min: 0, default: 500 }),
 *   defaultRegion: Setting.choice({ label: "Default region", options: { emea: "EMEA", na: "North America" }, default: "emea" }),
 * }
 */
export const Setting = {
  text: (spec: Declare<TextSetting>): TextSetting => ({ kind: "text", ...spec }),
  number: (spec: Declare<NumberSetting>): NumberSetting => ({ kind: "number", ...spec }),
  boolean: (spec: Declare<BooleanSetting>): BooleanSetting => ({ kind: "boolean", ...spec }),
  choice: <const Value extends string>(spec: {
    readonly label: string
    readonly description?: string
    readonly options: { readonly [K in Value]: string }
    readonly default: NoInfer<Value>
  }): ChoiceSetting<Value> => ({ kind: "choice", ...spec }),
}

/** Setting names: camelCase, as the app reads them (`settings.get("refundLimit")`). */
export const SettingNamePattern = /^[a-z][a-zA-Z0-9]*$/

const URL_PATTERN = /^https?:\/\/[^\s/]+(\/\S*)?$/

/**
 * Why `value` is not a valid value of the setting, in words for the form, or `undefined` when
 * it is. The same check runs in the form, in the platform before storing, and in the app.
 */
export const settingProblem = (setting: Setting, value: unknown): string | undefined => {
  switch (setting.kind) {
    case "text": {
      if (typeof value !== "string") return "Expected a text"
      if (setting.maxLength !== undefined && value.length > setting.maxLength)
        return `At most ${setting.maxLength} characters`
      if (setting.format === "url" && value !== "" && !URL_PATTERN.test(value))
        return "An address starting with http:// or https://"
      return undefined
    }
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) return "Expected a number"
      if (setting.integer === true && !Number.isInteger(value)) return "A whole number"
      if (setting.min !== undefined && value < setting.min) return `At least ${setting.min}`
      if (setting.max !== undefined && value > setting.max) return `At most ${setting.max}`
      return undefined
    }
    case "boolean":
      return typeof value === "boolean" ? undefined : "Expected yes or no"
    case "choice":
      return typeof value === "string" && Object.hasOwn(setting.options, value)
        ? undefined
        : `One of: ${Object.values(setting.options).join(", ")}`
  }
}

/** The setting's value: `value` when it fits the declaration, else the default (a stored value may predate it). */
export const settingValue = <S extends Setting>(setting: S, value: unknown): SettingValue<S> =>
  (value !== undefined && settingProblem(setting, value) === undefined ? value : setting.default) as SettingValue<S>

const declaration = <const Kind extends string, Value extends Schema.Top, const Fields extends Schema.Struct.Fields>(
  kind: Kind,
  value: Value,
  fields: Fields,
) =>
  Schema.Struct({
    name: Schema.String.check(Schema.isPattern(SettingNamePattern, { message: "camelCase" })),
    kind: Schema.Literal(kind),
    label: Schema.String,
    description: Schema.NullOr(Schema.String),
    default: value,
    ...fields,
  })

/** A declared setting as the manifest carries it (JSON): the declaration with its name. */
export const SettingDeclaration = Schema.Union([
  declaration("text", Schema.String, {
    multiline: Schema.Boolean,
    maxLength: Schema.NullOr(Schema.Number),
    format: Schema.NullOr(Schema.Literal("url")),
  }),
  declaration("number", Schema.Number, {
    min: Schema.NullOr(Schema.Number),
    max: Schema.NullOr(Schema.Number),
    integer: Schema.Boolean,
    unit: Schema.NullOr(Schema.String),
  }),
  declaration("boolean", Schema.Boolean, {}),
  declaration("choice", Schema.String, { options: Schema.Record(Schema.String, Schema.String) }),
])
export type SettingDeclaration = typeof SettingDeclaration.Type

/** The manifest's form of a setting. */
export const toSettingDeclaration = (name: string, setting: Setting): SettingDeclaration => {
  const base = { name, label: setting.label, description: setting.description ?? null }
  switch (setting.kind) {
    case "text":
      return {
        ...base,
        kind: "text",
        default: setting.default,
        multiline: setting.multiline ?? false,
        maxLength: setting.maxLength ?? null,
        format: setting.format ?? null,
      }
    case "number":
      return {
        ...base,
        kind: "number",
        default: setting.default,
        min: setting.min ?? null,
        max: setting.max ?? null,
        integer: setting.integer ?? false,
        unit: setting.unit ?? null,
      }
    case "boolean":
      return { ...base, kind: "boolean", default: setting.default }
    case "choice":
      return { ...base, kind: "choice", default: setting.default, options: { ...setting.options } }
  }
}

/** A setting from its manifest form: what the form and the platform check values against. */
export const fromSettingDeclaration = (declared: SettingDeclaration): Setting => {
  const base = {
    label: declared.label,
    ...(declared.description === null ? {} : { description: declared.description }),
  }
  switch (declared.kind) {
    case "text":
      return Setting.text({
        ...base,
        default: declared.default,
        ...(declared.multiline ? { multiline: true } : {}),
        ...(declared.maxLength === null ? {} : { maxLength: declared.maxLength }),
        ...(declared.format === null ? {} : { format: declared.format }),
      })
    case "number":
      return Setting.number({
        ...base,
        default: declared.default,
        ...(declared.integer ? { integer: true } : {}),
        ...(declared.min === null ? {} : { min: declared.min }),
        ...(declared.max === null ? {} : { max: declared.max }),
        ...(declared.unit === null ? {} : { unit: declared.unit }),
      })
    case "boolean":
      return Setting.boolean({ ...base, default: declared.default })
    case "choice":
      return { kind: "choice", ...base, default: declared.default, options: declared.options }
  }
}
