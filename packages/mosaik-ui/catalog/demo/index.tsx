import {
  Alert,
  Breadcrumb,
  Button,
  CheckboxField,
  CloseButton,
  ComboboxField,
  DatePickerField,
  FileUploadField,
  Heading,
  IconButton,
  Modal,
  NumberField,
  PageHeader,
  SelectField,
  Stat,
  TextareaField,
  Tooltip,
  toast,
} from "@mosaik/mosaik-ui"
import { CoffeeIcon, DownloadIcon, PlusIcon, RefreshCwIcon } from "lucide-solid"
import { createSignal, Show } from "solid-js"
import { Box, Grid, HStack, Stack } from "styled-system/jsx"
import { ORDERS, PRODUCTS } from "./data"
import { Orders } from "./Orders"
import { ApiKey, Fulfilment, Help, Reviews, Settings, Team } from "./Side"

/**
 * One screen of a made-up shop built from the library's components, as an app would use them
 * together: to judge the look and feel in context rather than one component at a time.
 */
export const App = () => {
  const [creating, setCreating] = createSignal(false)
  const [exporting, setExporting] = createSignal(false)
  const [notice, setNotice] = createSignal(true)

  return (
    <Stack gap="6">
      <Breadcrumb.Root>
        <Breadcrumb.List>
          <Breadcrumb.Item>
            <Breadcrumb.Link href="#/demo">Northwind Coffee</Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.Link href="#/demo">Sales</Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item>Orders</Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>

      <PageHeader
        icon={<CoffeeIcon />}
        title="Orders"
        description="What customers ordered, what waits, and how the shop is set up."
        actions={
          <HStack gap="2">
            <Tooltip content="Reload the orders">
              <IconButton variant="plain" aria-label="Reload" onClick={() => toast.info("Orders are up to date")}>
                <RefreshCwIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="outline"
              loading={exporting()}
              onClick={() => {
                setExporting(true)
                setTimeout(() => {
                  setExporting(false)
                  toast.success("Exported", "orders.csv, 128 orders")
                }, 1200)
              }}
            >
              <DownloadIcon /> Export
            </Button>
            <Button onClick={() => setCreating(true)}>
              <PlusIcon /> New order
            </Button>
          </HStack>
        }
      />

      <Show when={notice()}>
        <Alert.Root status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Kenya Nyeri runs out on Friday</Alert.Title>
            <Alert.Description>Four orders wait for it. The next roast is on Monday.</Alert.Description>
          </Alert.Content>
          <CloseButton
            pos="relative"
            top="-2"
            insetEnd="-2"
            size="sm"
            aria-label="Dismiss"
            onClick={() => setNotice(false)}
          />
        </Alert.Root>
      </Show>

      {/* A section of the page, under its title: the cards' titles are a level below. */}
      <Heading textStyle="lg" fontWeight="semibold" mb="-2">
        This month
      </Heading>
      <Grid columns={{ base: 1, sm: 2, xl: 4 }} gap="4">
        <Stat label="Revenue" value="€8,214" trend={{ value: "+12%", direction: "up" }} hint="Last 30 days" />
        <Stat label="Orders" value="128" trend={{ value: "+9", direction: "up" }} hint="Last 30 days" />
        <Stat label="Refunds" value="3" trend={{ value: "+1", direction: "down" }} hint="Last 30 days" />
        <Stat label="Repeat customers" value="41%" loading />
      </Grid>

      <Grid columns={{ base: 1, xl: 3 }} gap="6" alignItems="start">
        <Stack gap="6" gridColumn={{ xl: "span 2" }} minW="0">
          <Orders />
          <Grid columns={{ base: 1, md: 2 }} gap="6" alignItems="start">
            <Fulfilment />
            <Reviews />
          </Grid>
          <Help />
        </Stack>
        <Stack gap="6">
          <Team />
          <Settings />
          <ApiKey />
        </Stack>
      </Grid>

      <NewOrder open={creating()} onOpenChange={setCreating} />
    </Stack>
  )
}

/** A form in a modal: most of the fields a form takes. */
const NewOrder = (props: { readonly open: boolean; readonly onOpenChange: (open: boolean) => void }) => {
  const [customer, setCustomer] = createSignal<string | null>(null)
  const [tried, setTried] = createSignal(false)
  const customers = [...new Set(ORDERS.map((order) => order.customer))]
  const submit = () => {
    setTried(true)
    if (customer() === null) return
    toast.success("Order created", `For ${customer()}`)
    props.onOpenChange(false)
    setTried(false)
    setCustomer(null)
  }
  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="New order"
      description="For a customer who ordered by phone or in the shop."
      footer={
        <>
          <Button variant="outline" colorPalette="gray" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>Create order</Button>
        </>
      }
    >
      <Stack gap="4">
        <ComboboxField
          label="Customer"
          required
          placeholder="Type a name"
          items={customers}
          value={customer()}
          onValueChange={setCustomer}
          errorText={tried() && customer() === null ? "Choose a customer" : undefined}
        />
        <HStack gap="3" alignItems="start">
          <Box flex="1">
            <SelectField label="Coffee" items={PRODUCTS} defaultValue="House espresso" />
          </Box>
          <Box width="28">
            <NumberField label="Bags" min={1} max={20} defaultValue={1} />
          </Box>
        </HStack>
        <DatePickerField label="Deliver on" />
        <TextareaField label="Note" optionalText=" (optional)" placeholder="Ground for a moka pot, please" />
        <FileUploadField label="Invoice" accept={["application/pdf"]} helperText="A PDF, if they paid already." />
        <CheckboxField label="Email the customer a confirmation" defaultChecked />
      </Stack>
    </Modal>
  )
}
