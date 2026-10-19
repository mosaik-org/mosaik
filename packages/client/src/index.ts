// Framework-free: any page can use it, whatever it is built with. Solid helpers are in `./solid`.
export { type ApiClient, type BrowserApi, makeApiClient } from "./client"
export { errorMessage, errorTag, isPermanentError } from "./errors"
export * from "./format"
export {
  onPageThemeChange,
  type PageTheme,
  pageTheme,
  provideToaster,
  type Toast,
  type Toaster,
  type ToastType,
  toast,
} from "./shell"
