import { Stat } from "@mosaik/mosaik-ui"
import { Grid } from "styled-system/jsx"

export const App = () => (
  <Grid columns={{ base: 1, md: 3 }} gap="4">
    <Stat label="Revenue" value="€48,210" trend={{ value: "+12%", direction: "up" }} hint="Last 30 days" />
    <Stat label="Refunds" value="23" trend={{ value: "+4", direction: "down" }} />
    <Stat label="Customers" value="1,204" loading />
  </Grid>
)
