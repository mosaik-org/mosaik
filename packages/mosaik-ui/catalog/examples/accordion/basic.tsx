import { Accordion } from "@mosaik/mosaik-ui"
import { For } from "solid-js"

export const App = () => {
  return (
    <Accordion.Root defaultValue={[slug(faqItems[0]?.question ?? "")]} multiple>
      <For each={faqItems}>
        {(item) => (
          <Accordion.Item value={slug(item.question)}>
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
  )
}

/** Item values become element ids, so they cannot hold spaces. */
const slug = (text: string) => text.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")

const faqItems = [
  {
    question: "What is Mosaik UI?",
    answer: "A beautiful component library built with Ark UI and Panda CSS.",
  },
  {
    question: "How do I get started?",
    answer: "Visit our documentation for installation and usage guides.",
  },
  {
    question: "Is it free to use?",
    answer: "Yes! Mosaik UI is completely free and open source.",
  },
]
