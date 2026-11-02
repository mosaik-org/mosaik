import { createSignal } from "solid-js"

/**
 * Which conversation the side panel shows, and whether it is open: shared by the panel and the
 * assistant's own page, so a conversation moves between them (opened in full view, and back).
 */
const [panelOpen, setPanelOpen] = createSignal(false)
const [panelConversation, setPanelConversation] = createSignal<string | null>(null)

export { panelConversation, panelOpen, setPanelConversation, setPanelOpen }

/** Opens the side panel on a conversation (`null`: a new one). */
export const openPanel = (conversation: string | null) => {
  setPanelConversation(conversation)
  setPanelOpen(true)
}
