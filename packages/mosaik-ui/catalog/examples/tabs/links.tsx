import { Tabs, Text } from "@mosaik/mosaik-ui"
import { createSignal, For } from "solid-js"

const pages = [
  { value: "members", label: "Members", href: "/team/members" },
  { value: "projects", label: "Projects", href: "/team/projects" },
]

export const App = () => {
  const [href, setHref] = createSignal(pages[0]?.href)

  return (
    // `navigate` hands the link to your router, which here only says where it would go.
    <Tabs.Root defaultValue="members" navigate={(details) => setHref(new URL(details.href).pathname)}>
      <Tabs.List>
        <For each={pages}>
          {(page) => (
            <Tabs.Trigger
              value={page.value}
              asChild={(triggerProps) => (
                <a href={page.href} {...triggerProps()}>
                  {page.label}
                </a>
              )}
            />
          )}
        </For>
      </Tabs.List>
      <For each={pages}>
        {(page) => (
          <Tabs.Content value={page.value}>
            <Text textStyle="sm">Your router goes to {href()}</Text>
          </Tabs.Content>
        )}
      </For>
    </Tabs.Root>
  )
}
