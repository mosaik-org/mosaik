/** Paragraphs of placeholder text for examples that need something to scroll. */
const sentences = [
  "Mosaik UI builds on Ark UI for behavior and accessibility.",
  "Panda CSS compiles every recipe into one stylesheet ahead of time.",
  "Each component is a set of parts, styled through a slot recipe.",
  "Keyboard navigation, focus management and ARIA come from Ark's state machines.",
  "Colors come from palettes, and roles such as accent or danger choose among them.",
  "Dark mode follows a class or a data attribute on an ancestor element.",
]

export const filler = (count: number) =>
  Array.from(
    { length: count },
    (_, index) => `<p>${sentences.map((_, offset) => sentences[(index + offset) % sentences.length]).join(" ")}</p>`,
  ).join("")
