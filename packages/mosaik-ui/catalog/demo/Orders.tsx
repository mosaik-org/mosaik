import {
  ActionMenu,
  Avatar,
  Badge,
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  CloseButton,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Pagination,
  Popover,
  Progress,
  RangeSliderField,
  SegmentGroup,
  SelectField,
  Table,
  Tabs,
  TextField,
  ToggleGroup,
  toast,
} from "@mosaik/mosaik-ui"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisIcon,
  EyeIcon,
  InboxIcon,
  LayoutGridIcon,
  ListIcon,
  RotateCcwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  TrashIcon,
} from "lucide-solid"
import { createMemo, createSignal, For, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { css } from "styled-system/css"
import { Box, HStack, Stack } from "styled-system/jsx"
import { euro, ORDERS, type Order, STATUS } from "./data"

const hidden = css({ srOnly: true })

/** The orders: tabs by what they need, a toolbar to narrow them, the table, and pages. */
export const Orders = () => {
  const [query, setQuery] = createSignal("")
  const [status, setStatus] = createSignal<string | null>(null)
  const [selected, setSelected] = createSignal<ReadonlySet<string>>(new Set())
  const [deleting, setDeleting] = createSignal<Order | null>(null)

  const shown = createMemo(() =>
    ORDERS.filter(
      (order) =>
        (status() === null || order.status === status()) &&
        `${order.id} ${order.customer}`.toLowerCase().includes(query().trim().toLowerCase()),
    ),
  )
  const waiting = () => ORDERS.filter((order) => order.status === "pending").length
  const toggle = (id: string, on: boolean) =>
    setSelected((all) => {
      const next = new Set(all)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  return (
    <Card.Root>
      <Tabs.Root defaultValue="all">
        <Card.Header>
          <HStack justify="space-between" flexWrap="wrap" gap="3">
            <Stack gap="1">
              <Card.Title>Orders</Card.Title>
              <Card.Description>Everything customers ordered this month.</Card.Description>
            </Stack>
            <SegmentGroup.Root defaultValue="30 days" size="sm" aria-label="Period">
              <SegmentGroup.Indicator />
              <SegmentGroup.Items items={["7 days", "30 days", "90 days"]} />
            </SegmentGroup.Root>
          </HStack>
          <Tabs.List mt="4">
            <Tabs.Trigger value="all">All orders</Tabs.Trigger>
            <Tabs.Trigger value="waiting">
              Waiting <Badge size="sm">{waiting()}</Badge>
            </Tabs.Trigger>
            <Tabs.Trigger value="returns">Returns</Tabs.Trigger>
          </Tabs.List>
        </Card.Header>
        <Card.Body>
          <Tabs.Content value="all">
            <Stack gap="4">
              <HStack gap="3" flexWrap="wrap">
                <Box flex="1" minW="48" maxW="xs">
                  <TextField
                    aria-label="Search orders"
                    placeholder="Search by order or customer"
                    startElement={<SearchIcon />}
                    value={query()}
                    onValueChange={setQuery}
                  />
                </Box>
                <Box width="44">
                  <SelectField
                    aria-label="Status"
                    placeholder="Any status"
                    clearable
                    items={Object.entries(STATUS).map(([value, { label }]) => ({ value, label }))}
                    value={status()}
                    onValueChange={setStatus}
                  />
                </Box>
                <Filters />
                <ToggleGroup.Root
                  defaultValue={["list"]}
                  ml="auto"
                  asChild={(props) => (
                    <ButtonGroup variant="outline" size="sm" attached {...props()}>
                      <ToggleGroup.Item
                        value="list"
                        asChild={(item) => (
                          <IconButton aria-label="Show as a list" {...item()}>
                            <ListIcon />
                          </IconButton>
                        )}
                      />
                      <ToggleGroup.Item
                        value="grid"
                        asChild={(item) => (
                          <IconButton aria-label="Show as cards" {...item()}>
                            <LayoutGridIcon />
                          </IconButton>
                        )}
                      />
                    </ButtonGroup>
                  )}
                />
              </HStack>
              <Show when={selected().size > 0}>
                <HStack gap="3" px="3" py="2" bg="accent.subtle.bg" borderRadius="l2" textStyle="sm">
                  <span>{selected().size} selected</span>
                  <Button size="xs" variant="outline" onClick={() => toast.success("Labels printed")}>
                    Print labels
                  </Button>
                  <Button size="xs" variant="plain" onClick={() => setSelected(new Set<string>())}>
                    Clear
                  </Button>
                </HStack>
              </Show>
              <Table.Root>
                <Table.Head>
                  <Table.Row>
                    <Table.Header width="10">
                      <span class={hidden}>Selected</span>
                    </Table.Header>
                    <Table.Header>Order</Table.Header>
                    <Table.Header>Customer</Table.Header>
                    <Table.Header>Status</Table.Header>
                    <Table.Header>Packed</Table.Header>
                    <Table.Header textAlign="right">Amount</Table.Header>
                    <Table.Header width="10">
                      <span class={hidden}>Actions</span>
                    </Table.Header>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  <For each={shown()}>
                    {(order) => (
                      <Row
                        order={order}
                        selected={selected().has(order.id)}
                        onSelect={(on) => toggle(order.id, on)}
                        onDelete={() => setDeleting(order)}
                      />
                    )}
                  </For>
                </Table.Body>
              </Table.Root>
              <Show when={shown().length === 0}>
                <EmptyState
                  icon={<SearchIcon />}
                  title="No orders match"
                  description="Try another name, or any status."
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setQuery("")
                        setStatus(null)
                      }}
                    >
                      Clear the search
                    </Button>
                  }
                />
              </Show>
              <HStack justify="space-between" flexWrap="wrap" gap="3">
                <span class={css({ textStyle: "sm", color: "fg.muted" })}>{shown().length} of 128 orders</span>
                <Pagination.Root count={128} pageSize={10} defaultPage={1}>
                  <ButtonGroup variant="outline" size="sm">
                    <Pagination.PrevTrigger
                      asChild={(props) => (
                        <IconButton colorPalette="gray" {...props()}>
                          <ChevronLeftIcon />
                        </IconButton>
                      )}
                    />
                    <Pagination.Items
                      render={(page, item) => (
                        <IconButton
                          variant={page.selected ? "solid" : "outline"}
                          colorPalette={page.selected ? "accent" : "gray"}
                          {...item()}
                        >
                          {page.value}
                        </IconButton>
                      )}
                    />
                    <Pagination.NextTrigger
                      asChild={(props) => (
                        <IconButton colorPalette="gray" {...props()}>
                          <ChevronRightIcon />
                        </IconButton>
                      )}
                    />
                  </ButtonGroup>
                </Pagination.Root>
              </HStack>
            </Stack>
          </Tabs.Content>
          <Tabs.Content value="waiting">
            <Stack gap="2">
              <For each={ORDERS.filter((order) => order.status === "pending")}>
                {(order) => (
                  <HStack justify="space-between" p="3" borderWidth="1px" borderRadius="l2">
                    <span class={css({ textStyle: "sm" })}>
                      <strong>{order.id}</strong> · {order.customer} · {euro(order.amount)}
                    </span>
                    <HStack gap="2">
                      <Button size="xs" variant="outline" onClick={() => toast.info(`${order.id} put on hold`)}>
                        Hold
                      </Button>
                      <Button size="xs" onClick={() => toast.success(`${order.id} approved`)}>
                        Approve
                      </Button>
                    </HStack>
                  </HStack>
                )}
              </For>
            </Stack>
          </Tabs.Content>
          <Tabs.Content value="returns">
            <EmptyState
              icon={<InboxIcon />}
              title="No returns"
              description="Returns customers ask for show here, to approve or refuse."
            />
          </Tabs.Content>
        </Card.Body>
      </Tabs.Root>
      <ConfirmDialog
        open={deleting() !== null}
        onOpenChange={(open) => open || setDeleting(null)}
        title={`Delete ${deleting()?.id ?? "the order"}?`}
        description="The customer is not told. This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => {
          toast.success(`${deleting()?.id} deleted`)
          setDeleting(null)
        }}
      />
    </Card.Root>
  )
}

const Row = (props: {
  readonly order: Order
  readonly selected: boolean
  readonly onSelect: (on: boolean) => void
  readonly onDelete: () => void
}) => {
  const status = () => STATUS[props.order.status]
  return (
    <Table.Row>
      <Table.Cell>
        <Checkbox.Root
          size="sm"
          checked={props.selected}
          onCheckedChange={(details) => props.onSelect(details.checked === true)}
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Checkbox.Label class={hidden}>Select {props.order.id}</Checkbox.Label>
        </Checkbox.Root>
      </Table.Cell>
      <Table.Cell fontWeight="medium" fontVariantNumeric="tabular-nums">
        {props.order.id}
        <div class={css({ textStyle: "xs", color: "fg.muted", fontWeight: "normal" })}>{props.order.placed}</div>
      </Table.Cell>
      <Table.Cell>
        <HStack gap="3">
          <Avatar.Root size="sm">
            <Avatar.Fallback name={props.order.customer} />
          </Avatar.Root>
          <Stack gap="0">
            <span>{props.order.customer}</span>
            <span class={css({ textStyle: "xs", color: "fg.muted" })}>{props.order.email}</span>
          </Stack>
        </HStack>
      </Table.Cell>
      <Table.Cell>
        <Badge colorPalette={status().palette}>{status().label}</Badge>
      </Table.Cell>
      <Table.Cell minW="32">
        <Progress.Root value={props.order.fulfilled} size="sm" aria-label={`${props.order.id} packed`}>
          <Progress.Track>
            <Progress.Range />
          </Progress.Track>
        </Progress.Root>
      </Table.Cell>
      <Table.Cell textAlign="right" fontVariantNumeric="tabular-nums">
        {euro(props.order.amount)}
      </Table.Cell>
      <Table.Cell>
        <ActionMenu
          trigger={(trigger) => (
            <IconButton variant="plain" size="xs" aria-label={`Actions for ${props.order.id}`} {...trigger()}>
              <EllipsisIcon />
            </IconButton>
          )}
          items={[
            {
              value: "view",
              label: "View order",
              icon: <EyeIcon />,
              onSelect: () => toast.info(`Opening ${props.order.id}`),
            },
            {
              value: "refund",
              label: "Refund",
              icon: <RotateCcwIcon />,
              disabled: props.order.status === "refunded",
              onSelect: () => toast.warning(`${props.order.id} refunded`, euro(props.order.amount)),
            },
            { value: "delete", label: "Delete", icon: <TrashIcon />, danger: true, onSelect: props.onDelete },
          ]}
        />
      </Table.Cell>
    </Table.Row>
  )
}

/** More ways to narrow the orders, in a popover. */
const Filters = () => (
  <Popover.Root>
    <Popover.Trigger
      asChild={(trigger) => (
        <Button variant="outline" {...trigger()}>
          <SlidersHorizontalIcon /> Filters
        </Button>
      )}
    />
    <Portal>
      <Popover.Positioner>
        <Popover.Content>
          <Popover.Arrow />
          <Popover.Body>
            <Stack gap="4" minW="64">
              <Popover.Title>Filters</Popover.Title>
              <RangeSliderField
                label="Amount"
                showValue
                min={0}
                max={250}
                step={5}
                defaultValue={[20, 150]}
                format={(value) => `€${value}`}
              />
            </Stack>
          </Popover.Body>
          <Popover.CloseTrigger asChild={(trigger) => <CloseButton size="sm" {...trigger()} />} />
        </Popover.Content>
      </Popover.Positioner>
    </Portal>
  </Popover.Root>
)
