import { type JSX, Show } from "solid-js"
import { createSlotRecipeContext } from "../../styled-system/jsx"
import { pageHeader } from "../../styled-system/recipes"

const { withProvider, withContext } = createSlotRecipeContext(pageHeader)
const Root = withProvider("header", "root")
const Heading = withContext("div", "heading")
const Icon = withContext("div", "icon")
const Content = withContext("div", "content")
const Title = withContext("h1", "title")
const Description = withContext("p", "description")
const Actions = withContext("div", "actions")

export interface PageHeaderProps {
  readonly title: JSX.Element
  readonly description?: JSX.Element
  /** The page's own actions, such as "New order". */
  readonly actions?: JSX.Element
  readonly icon?: JSX.Element
  /** On the header, e.g. a class with a `colorPalette` for its icon's tile. */
  readonly class?: string
}

/** The top of a page: its `<h1>`, what the page is for, and its actions. */
export const PageHeader = (props: PageHeaderProps) => (
  <Root class={props.class}>
    <Heading>
      <Show when={props.icon}>
        <Icon aria-hidden="true">{props.icon}</Icon>
      </Show>
      <Content>
        <Title>{props.title}</Title>
        <Show when={props.description}>
          <Description>{props.description}</Description>
        </Show>
      </Content>
    </Heading>
    <Show when={props.actions}>
      <Actions>{props.actions}</Actions>
    </Show>
  </Root>
)
