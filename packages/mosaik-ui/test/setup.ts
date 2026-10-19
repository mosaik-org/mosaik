import { cleanup } from "@solidjs/testing-library"
import { afterEach } from "vitest"

// What jsdom lacks and Ark's state machines call: layout observers, scrolling, media queries.
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserver as unknown as typeof globalThis.ResizeObserver
globalThis.IntersectionObserver ??= ResizeObserver as unknown as typeof globalThis.IntersectionObserver
Element.prototype.scrollIntoView ??= () => {}
Element.prototype.scrollTo ??= () => {}
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList

afterEach(() => cleanup())
