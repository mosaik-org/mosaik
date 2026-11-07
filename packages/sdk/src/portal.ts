/** `@mosaik/sdk/portal`: an app mounted in the Portal's shell: its pages, frame, icon and commands. */

export {
  AccessDenied,
  AppIcon,
  type AppIconName,
  type AppIconProps,
  AppLayout,
  type AppLayoutProps,
  appColor,
  appColorClass,
  appIconNames,
  type Command,
  type CommandApp,
  defineSearchProvider,
  FRAME_TOP,
  FrameHeader,
  type NavTabItem,
  NavTabs,
  type PageLayout,
  type SearchProvider,
  type SearchProviderLoader,
  type SearchResult,
  type SearchSource,
  useCommandPalette,
  useCommands,
} from "@mosaik/frame"
export { defineWebApp, type WebApp } from "@mosaik/portal/web"
