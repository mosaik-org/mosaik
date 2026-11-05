import { Tabs } from "@mosaik/mosaik-ui"

export const App = () => (
  <Tabs.Root defaultValue="members">
    <Tabs.List>
      <Tabs.Trigger value="members">Members</Tabs.Trigger>
      <Tabs.Trigger value="projects">Projects</Tabs.Trigger>
      <Tabs.Trigger value="billing" disabled>
        Billing
      </Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="members">Who is on the team.</Tabs.Content>
    <Tabs.Content value="projects">What the team works on.</Tabs.Content>
    <Tabs.Content value="billing">What the team pays.</Tabs.Content>
  </Tabs.Root>
)
