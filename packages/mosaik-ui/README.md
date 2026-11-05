# @mosaik/mosaik-ui

Accessible components for [Solid](https://www.solidjs.com), built on [Ark UI](https://ark-ui.com)
(behavior, keyboard, focus and ARIA) and styled with [Panda CSS](https://panda-css.com) recipes. It
works in any Solid app, with or without Panda, rendered in the browser or on the server.

```tsx
import "@mosaik/mosaik-ui/styles.css"
import { Button, SelectField, TextField } from "@mosaik/mosaik-ui"

<TextField label="Email" type="email" value={email()} onValueChange={setEmail} errorText={error()} />
<SelectField label="Status" items={["Open", "Closed"]} value={status()} onValueChange={setStatus} />
<Button type="submit">Save</Button>
```

It lives in the Mosaik repository for now, where Mosaik's UI is built with it. It imports nothing of
Mosaik (`bun lint` checks it), so it can move to a repository of its own.

## Using it

Install `@mosaik/mosaik-ui` and `solid-js`. Then pick how the styles get to the page.

**Without Panda.** Import the stylesheet once. It holds every component, variant, palette and token,
in cascade layers (`reset, base, tokens, recipes, utilities`), so your own CSS wins without
`!important`:

```ts
import "@mosaik/mosaik-ui/styles.css"
```

To load less, import the layers and the recipes you use from `@mosaik/mosaik-ui/styles/*`
(`tokens.css`, `recipes/button.css`, ...) after declaring the layer order yourself:
`@layer reset, base, tokens, recipes, utilities;`.

Style props on components (`<Button mt="4">`) need Panda: without it, use `class`.

**With Panda** (2.x). Point Panda at the library instead of scanning it:

```ts
// panda.config.ts
export default defineConfig({
  designSystem: "@mosaik/mosaik-ui",
  include: ["./src/**/*.{ts,tsx}"],
  jsxFramework: "solid",
})
```

Your code then styles itself with the library's tokens, recipes and patterns, from the library:

```tsx
import { css } from "@mosaik/mosaik-ui/css"
import { Stack } from "@mosaik/mosaik-ui/jsx"

<main class={css({ p: "6", bg: "accent.subtle.bg" })}>
```

Panda generates the library's styles from its build info, plus yours. Class names and CSS variables
carry the `mk` prefix, so they never collide with another Panda build on the page.

**Server rendering.** The package's `solid` export condition gives Vite and SolidStart the sources,
which they compile for the browser or the server (hydratable or not). Other tools get prebuilt DOM
(`browser`) and server (`node`) builds.

## Components

Each component is a set of **parts** named after Ark's, styled by a slot recipe, with every Ark prop
and `asChild`:

```tsx
<Dialog.Root>
  <Dialog.Trigger asChild={(trigger) => <Button {...trigger()}>Edit</Button>} />
  <Portal>
    <Dialog.Backdrop />
    <Dialog.Positioner>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Edit profile</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>...</Dialog.Body>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog.Root>
```

| | |
|---|---|
| Actions | `Button`, `ButtonGroup`, `IconButton`, `CloseButton`, `Toggle`, `ToggleGroup`, `Link`, `Clipboard` |
| Form controls | `Field`, `Fieldset`, `Input`, `InputGroup`, `InputAddon`, `Textarea`, `PasswordInput`, `NumberInput`, `PinInput`, `Checkbox`, `RadioGroup`, `RadioCardGroup`, `Switch`, `Select`, `Combobox`, `TagsInput`, `SegmentGroup`, `Slider`, `RatingGroup`, `DatePicker`, `ColorPicker`, `FileUpload`, `Editable` |
| Overlays | `Dialog`, `Drawer`, `Popover`, `HoverCard`, `Tooltip`, `Menu`, `Command`, `Toaster` / `toaster` |
| Navigation | `Tabs`, `Breadcrumb`, `Pagination`, `Steps`, `Accordion`, `Collapsible` |
| Display | `Card`, `Alert`, `Badge`, `Avatar`, `Table`, `Code`, `Kbd`, `Heading`, `Text`, `DisplayValue`, `Image`, `Icon`, `Progress`, `Skeleton`, `Spinner`, `Loader`, `Carousel`, `ScrollArea`, `Splitter` |
| Layout | `Group`, `AbsoluteCenter`, `Span` |
| Collections | `createListCollection`, `useListCollection`, `useFilter`: the items `Select`, `Combobox` and `Command` parts take |

## Fields

For forms, the **fields** put a label, the control, help and the error together, linked for
assistive technology. They take plain values and give plain values back: no change events to unpack.

| Field | Value |
|---|---|
| `TextField`, `TextareaField`, `PasswordField` | `string` |
| `NumberField` | `number \| null` (`null` while empty); `formatOptions` for currency, percent, ... |
| `SelectField`, `ComboboxField`, `RadioGroupField` | `string \| null`, from `items` (`["Open", "Closed"]` or `{ label, value, disabled }`) |
| `CheckboxField`, `SwitchField` | `checked: boolean` |
| `SliderField` / `RangeSliderField` | `number` / `[number, number]` |
| `DatePickerField` / `DateRangePickerField` | ISO dates, `"2026-10-19"` / `["2026-10-01", "2026-10-31"]` |

All of them take the same props besides the value:

- `label`, `helperText`;
- `errorText`, which marks the field invalid while set;
- `optionalText`, shown after the label of a field that is not `required`;
- `required`, `disabled`, `readOnly`, `invalid`, `name`;
- `onBlur`, so a form can show a field's error once it was left.

They are controlled (`value`) or not (`defaultValue`). `FormField` wraps a control of your own the
same way. `TextField` also takes `suggestions` (offered as people type) and `maxLength`; the choice
fields take a union of strings (`SelectField<"open" | "closed">`) and give it back typed.

The library has no form state or validation: pass `errorText` from whatever checks your form. With
`noValidate` on the `<form>`, people read your messages, not the browser's.

## Ready-made components

For what most pages need, without composing parts:

| | |
|---|---|
| `Modal` | a dialog with a title, a body that scrolls and a footer: `<Modal open={open()} onOpenChange={setOpen} title="New user" footer={...}>` |
| `ConfirmDialog` | asks before an action: `title`, `confirmLabel`, `tone="danger"`, `loading`, `onConfirm` |
| `ActionMenu` | actions behind a button, such as a table row's "…": `trigger={(trigger) => <IconButton {...trigger()} />}`, `items` (with `danger`, `disabled`), and choices above them as children (`ThemeChoice`) |
| `EmptyState`, `ErrorState` | instead of an empty list, or of what failed to load (with "Try again") |
| `Stat` | a number in a card, with a trend and a hint |
| `ThemeProvider`, `ThemeToggle`, `ThemeChoice`, `useTheme` | light, dark or the system's, kept across visits, on `<html class="dark">`: a button with its menu, or a row of an `ActionMenu` |
| `toast` | `toast.success("Saved")`, `toast.error("Could not save", reason)`, shown by one `<Toaster />` |

## Theming

Colors come in **palettes** (`slate`, `neutral`, `indigo`, `blue`, `green`, `red`, `amber`, `orange`, `teal`,
`violet`, `pink`), each a 12-step scale with the colors the recipes read (`solid.bg`, `subtle.fg`,
`surface.border`, ...). Components use **roles**:

- `accent`: primary actions, focus, selection; indigo;
- `gray`: surfaces, borders and text; slate, a cool grey (`neutral` for a pure one);
- `danger`: red;
- `success`: green;
- `warning`: amber.

`colorPalette` picks a role or a palette for any component: `<Button colorPalette="danger">`.

**Grey unless something asks.** Components are grey by default: badges, tabs, keys, avatars,
menus. The accent is kept for what acts and what the person set: the primary (solid) button,
links, checked boxes, radios and switches, sliders, progress, steps, chosen days, focused fields
and selected text. Rare like that, it shows where to look. Ask for it elsewhere with
`colorPalette="accent"`.

**States** (paid, failed, healthy) are `<Badge variant="dot" colorPalette="success">`: a small
coloured mark and words in the text's colour, so a column of them stays readable and calm. The
other variants are for labels and counts.

**Fonts:** none of its own. Text takes the page's font; `Code` and `Kbd` take the theme's `mono`
(the system's monospace font unless your theme names one).

**Focus** from the keyboard shows as a halo: a translucent ring in the accent colour around the
control, and a field's border in the accent colour.

**Motion** has three easings: `enter` for what appears, `exit` for what leaves (quicker than
arriving), `standard` for a change within a control. When the system asks for reduced motion, what
slides or zooms in only fades: the keyframes scale their distances by `--motion`, 0 then.

**Dark mode** follows a `dark` class or `data-theme="dark"` on an ancestor, usually `<html>`.

**Your brand**:
- **With Panda:** override a role's tokens in your config, or build from
  `createPreset({ accent: "blue", radius: "lg" })` (`@mosaik/mosaik-ui/preset`) with the library's
  `prefix`.
  - The preset alone produces the whole stylesheet: every recipe and palette, and the few styles the
    components set inline. A test keeps that true.
  - A build that styles only its own code, on a page that loads the library's stylesheet already, uses
    `createPreset({ ..., staticCss: false })`.
- **Without Panda:** set the role's CSS variables on `<html>` (`--mk-colors-accent-solid-bg`, ...).

## Developing

| Command (in `packages/mosaik-ui`) | |
|---|---|
| `bun run catalog` | the catalog at http://localhost:6006: every example of every component, light and dark, with any accent |
| `bun run test` | behavior and accessibility (axe) of the fields, the ready-made components and every catalog example in a DOM; every example rendered on the server; the preset producing everything the components use |
| `bun run typecheck` | the sources, the catalog, the tests and the scripts |
| `bun run build` | the published package in `dist/package/`, packed to `dist/*.tgz` |
| `bun run verify` | after `build`: installs the tarball into the apps in `verify/` (one without Panda, one with `designSystem`) and renders on the server |

- **Adding a component:** its recipe goes in `src/theme/recipes/` and its parts in
  `src/components/`, with `createSlotRecipeContext`. Its examples go in
  `catalog/examples/<component>/`. The tests pick the examples up. Style it through its recipe:
  an inline style (`<Button px="0">`) must also be listed in `src/theme/static-css.ts`, or the
  stylesheet test fails.
- **Generated files:** `styled-system/` is generated by `panda codegen` (the `prepare` script).

## License

MIT. The theme, recipes and components started from [Park UI](https://park-ui.com) (MIT), and the
icons are [Lucide](https://lucide.dev)'s (ISC); see [LICENSE](LICENSE).
