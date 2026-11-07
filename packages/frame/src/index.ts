/**
 * The frame around a page: its layout, tabs and header, the command palette and shortcuts, status marks
 * and app icons. It serves whatever hosts pages, the Portal's shell and Core's console alike, as the
 * console's pages run in both. Apps mounted in the shell get it from `@mosaik/web-sdk/portal`; a standalone
 * app has no frame, so it is not part of the rest of the SDK.
 */
export { AccessDenied } from "./AccessDenied"
export { AppIcon, type AppIconName, type AppIconProps, appIconNames } from "./AppIcon"
export { AppLayout, type AppLayoutProps } from "./AppLayout"
export { appColor, appColorClass, appPalette, type Colored } from "./appColor"
export { appPageLinks, currentPage } from "./appPages"
export * from "./commands"
export { FrameHeader, FrameHeaderProvider } from "./FrameHeader"
export { createFrameHeaderStack, type FrameHeaderStack } from "./frameHeaderStack"
export { bestScore, fuzzyScore } from "./fuzzy"
export { isChunkLoadError, withTimeout } from "./loading"
export { type NavTabItem, NavTabs } from "./NavTabs"
export { FRAME_TOP, type PageLayout, PageMain, usePageLayout } from "./PageMain"
export { PageTitle } from "./PageTitle"
export { StatusMark, useStatusSummary } from "./StatusMark"
export { isQuiet, type StatusSummary, statusesAt, summarize } from "./statusSummary"
