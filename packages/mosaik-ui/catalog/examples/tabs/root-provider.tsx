import { Button, Tabs } from "@mosaik/mosaik-ui"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const tabs = Tabs.useTabs({ defaultValue: "members" })

  return (
    <Stack gap="4" alignItems="start">
      <Button variant="outline" onClick={() => tabs().setValue("projects")}>
        Go to Projects
      </Button>
      <Tabs.RootProvider value={tabs}>
        <Tabs.List>
          <Tabs.Trigger value="members">Members</Tabs.Trigger>
          <Tabs.Trigger value="projects">Projects</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="members">Who is on the team.</Tabs.Content>
        <Tabs.Content value="projects">What the team works on.</Tabs.Content>
      </Tabs.RootProvider>
    </Stack>
  )
}
