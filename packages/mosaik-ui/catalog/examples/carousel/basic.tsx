import { Carousel, IconButton, Text } from "@mosaik/mosaik-ui"
import ChevronLeftIcon from "lucide-solid/icons/chevron-left"
import ChevronRightIcon from "lucide-solid/icons/chevron-right"
import { Center } from "styled-system/jsx"

export const App = () => {
  const slides = 5

  return (
    <Carousel.Root slideCount={slides}>
      <Carousel.ItemGroup>
        {Array.from({ length: slides }, (_, index) => (
          <Carousel.Item index={index}>
            <Center bg="colorPalette.subtle.bg" height="48" borderRadius="l2">
              <Text textStyle="3xl" fontWeight="semibold" color="colorPalette.subtle.fg">
                {index + 1}
              </Text>
            </Center>
          </Carousel.Item>
        ))}
      </Carousel.ItemGroup>
      <Carousel.Control>
        <Carousel.PrevTrigger
          asChild={(triggerProps) => (
            <IconButton size="sm" variant="plain" {...triggerProps()}>
              <ChevronLeftIcon />
            </IconButton>
          )}
        />
        <Carousel.IndicatorGroup />
        <Carousel.NextTrigger
          asChild={(triggerProps) => (
            <IconButton size="sm" variant="plain" {...triggerProps()}>
              <ChevronRightIcon />
            </IconButton>
          )}
        />
      </Carousel.Control>
    </Carousel.Root>
  )
}
