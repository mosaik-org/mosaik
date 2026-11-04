import {
  Accordion,
  Avatar,
  Badge,
  Button,
  Card,
  CheckboxField,
  Clipboard,
  Code,
  DatePickerField,
  Editable,
  HoverCard,
  IconButton,
  Kbd,
  Link,
  NumberField,
  RadioGroupField,
  RatingGroup,
  Skeleton,
  SkeletonCircle,
  SliderField,
  Steps,
  SwitchField,
  TagsInput,
  Text,
  toast,
} from "@mosaik/mosaik-ui"
import { CheckIcon, MapPinIcon, RefreshCwIcon } from "lucide-solid"
import { createSignal, For, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { css } from "styled-system/css"
import { HStack, Stack } from "styled-system/jsx"
import { type Member, TEAM } from "./data"

/** Where the oldest open order is: ordered, paid, packed, on its way. */
export const Fulfilment = () => {
  const steps = [
    { title: "Paid", description: "Mon", detail: "Paid by card on Monday." },
    { title: "Packed", description: "Today", detail: "Packed this morning, waiting for the courier." },
    { title: "Shipped", description: "Tomorrow", detail: "The courier collects it tomorrow at 10." },
  ]
  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>NW-1039 on its way</Card.Title>
        <Card.Description>Margaret Hamilton, 2 bags</Card.Description>
      </Card.Header>
      <Card.Body>
        <Steps.Root count={steps.length} defaultStep={1} size="sm">
          <Steps.List>
            <For each={steps}>
              {(step, index) => (
                <Steps.Item index={index()}>
                  <Steps.Trigger>
                    <Steps.Indicator>
                      <Steps.ItemContext>
                        {(item) => (item().completed ? <CheckIcon /> : index() + 1)}
                      </Steps.ItemContext>
                    </Steps.Indicator>
                    <div>
                      <Steps.Title>{step.title}</Steps.Title>
                      <Steps.Description>{step.description}</Steps.Description>
                    </div>
                  </Steps.Trigger>
                  <Steps.Separator />
                </Steps.Item>
              )}
            </For>
          </Steps.List>
          <For each={steps}>
            {(step, index) => (
              <Steps.Content index={index()}>
                <Text textStyle="sm" color="fg.muted" pt="3">
                  {step.detail}
                </Text>
              </Steps.Content>
            )}
          </For>
        </Steps.Root>
      </Card.Body>
    </Card.Root>
  )
}

/** Who runs the shop: a hover card on each name. */
export const Team = () => (
  <Card.Root>
    <Card.Header>
      <Card.Title>Team</Card.Title>
      <Card.Description>Two of three online.</Card.Description>
    </Card.Header>
    <Card.Body>
      <Stack gap="3">
        <For each={TEAM}>{(member) => <Person member={member} />}</For>
      </Stack>
    </Card.Body>
  </Card.Root>
)

const Person = (props: { readonly member: Member }) => (
  <HStack justify="space-between">
    <HStack gap="3">
      <Avatar.Root size="sm">
        <Avatar.Fallback name={props.member.name} />
      </Avatar.Root>
      <HoverCard.Root>
        <HoverCard.Trigger
          asChild={(trigger) => (
            <Link href="#/demo" textStyle="sm" {...trigger()}>
              {props.member.name}
            </Link>
          )}
        />
        <Portal>
          <HoverCard.Positioner>
            <HoverCard.Content>
              <HoverCard.Arrow>
                <HoverCard.ArrowTip />
              </HoverCard.Arrow>
              <HStack gap="4" alignItems="start">
                <Avatar.Root size="lg">
                  <Avatar.Fallback name={props.member.name} />
                </Avatar.Root>
                <Stack gap="1">
                  <Text textStyle="sm" fontWeight="semibold">
                    {props.member.name}
                  </Text>
                  <Text textStyle="sm" color="fg.muted">
                    {props.member.role} at Northwind Coffee
                  </Text>
                  <HStack gap="1" color="fg.subtle" textStyle="xs">
                    <MapPinIcon size={12} /> {props.member.location}
                  </HStack>
                </Stack>
              </HStack>
            </HoverCard.Content>
          </HoverCard.Positioner>
        </Portal>
      </HoverCard.Root>
    </HStack>
    <Badge size="sm" colorPalette={props.member.online ? "success" : "gray"} variant="surface">
      {props.member.online ? "Online" : "Away"}
    </Badge>
  </HStack>
)

/** The shop's settings: most of the form fields, as a settings page has them. */
export const Settings = () => {
  const [ships, setShips] = createSignal<string | null>("2026-12-18")
  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>Shop</Card.Title>
        <Card.Description>How orders are taken and sent.</Card.Description>
      </Card.Header>
      <Card.Body>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            toast.success("Settings saved")
          }}
        >
          <Stack gap="5">
            <Editable.Root defaultValue="Northwind Coffee" activationMode="dblclick">
              <Editable.Label>Shop name</Editable.Label>
              <Editable.Area>
                <Editable.Input />
                <Editable.Preview />
              </Editable.Area>
            </Editable.Root>
            <SwitchField label="Take orders" defaultChecked helperText="Customers can order while it is on." />
            <RadioGroupField label="Shipping" items={["Standard", "Express", "Pickup"]} defaultValue="Standard" />
            <NumberField
              label="Free shipping from"
              formatOptions={{ style: "currency", currency: "EUR" }}
              defaultValue={40}
              min={0}
            />
            <SliderField label="Roast batch" showValue defaultValue={60} format={(value) => `${value} kg`} />
            <TagsInput.Root defaultValue={["Single origin", "Organic"]}>
              <TagsInput.Label>Labels</TagsInput.Label>
              <TagsInput.Control>
                <TagsInput.Items />
                <TagsInput.Input placeholder="Add a label" />
              </TagsInput.Control>
            </TagsInput.Root>
            <DatePickerField label="Last day to order for Christmas" value={ships()} onValueChange={setShips} />
            <CheckboxField label="Email me every new order" />
            <Button type="submit" alignSelf="start">
              Save
            </Button>
          </Stack>
        </form>
      </Card.Body>
    </Card.Root>
  )
}

/** The key for the shop's API, to copy. */
export const ApiKey = () => (
  <Card.Root>
    <Card.Header>
      <Card.Title>API key</Card.Title>
      <Card.Description>For the warehouse's scanner.</Card.Description>
    </Card.Header>
    <Card.Body>
      <Stack gap="3">
        <HStack gap="2">
          <Code flex="1" truncate>
            nw_live_4f9a2c81e7d3
          </Code>
          <Clipboard.Root value="nw_live_4f9a2c81e7d3">
            <Clipboard.Trigger
              asChild={(trigger) => (
                <IconButton variant="surface" size="sm" aria-label="Copy the key" {...trigger()}>
                  <Clipboard.Indicator />
                </IconButton>
              )}
            />
          </Clipboard.Root>
        </HStack>
        <Text textStyle="xs" color="fg.muted">
          Search the shop with <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>.
        </Text>
      </Stack>
    </Card.Body>
  </Card.Root>
)

/** Reviews, loading at first: skeletons, then the rating. */
export const Reviews = () => {
  const [loading, setLoading] = createSignal(true)
  setTimeout(() => setLoading(false), 1500)
  return (
    <Card.Root>
      <Card.Header>
        <HStack justify="space-between">
          <Card.Title>Reviews</Card.Title>
          <IconButton
            variant="plain"
            size="xs"
            aria-label="Reload the reviews"
            onClick={() => {
              setLoading(true)
              setTimeout(() => setLoading(false), 1500)
            }}
          >
            <RefreshCwIcon />
          </IconButton>
        </HStack>
      </Card.Header>
      <Card.Body>
        <Show
          when={!loading()}
          fallback={
            <HStack gap="3">
              <SkeletonCircle boxSize="10" />
              <Stack flex="1" gap="2">
                <Skeleton height="4" />
                <Skeleton height="4" width="70%" />
              </Stack>
            </HStack>
          }
        >
          <Stack gap="2">
            <HStack gap="3">
              <span class={css({ textStyle: "3xl", fontWeight: "semibold" })}>4.6</span>
              <RatingGroup.Root count={5} defaultValue={4.5} allowHalf readOnly size="sm">
                <RatingGroup.Label class={css({ srOnly: true })}>Average rating</RatingGroup.Label>
                <RatingGroup.HiddenInput />
                <RatingGroup.Control />
              </RatingGroup.Root>
            </HStack>
            <Text textStyle="sm" color="fg.muted">
              “The Guji is the best coffee I have had this year.” — Ada
            </Text>
          </Stack>
        </Show>
      </Card.Body>
    </Card.Root>
  )
}

/** Questions the team asks. */
export const Help = () => {
  const questions = [
    {
      id: "refund",
      question: "How do refunds work?",
      answer: "Refund an order from its menu; the money is back in 3–5 days.",
    },
    { id: "pickup", question: "Can customers pick up?", answer: "Yes, at the roastery on weekdays, from 10 to 18." },
    {
      id: "stock",
      question: "What if a coffee runs out?",
      answer: "Its orders wait, and the customer is told by email.",
    },
  ]
  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>Help</Card.Title>
      </Card.Header>
      <Card.Body>
        <Accordion.Root collapsible defaultValue={["refund"]}>
          <For each={questions}>
            {(item) => (
              <Accordion.Item value={item.id}>
                <Accordion.ItemTrigger>
                  {item.question}
                  <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>
                <Accordion.ItemContent>
                  <Accordion.ItemBody>{item.answer}</Accordion.ItemBody>
                </Accordion.ItemContent>
              </Accordion.Item>
            )}
          </For>
        </Accordion.Root>
      </Card.Body>
    </Card.Root>
  )
}
