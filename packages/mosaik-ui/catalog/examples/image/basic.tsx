import { Image } from "@mosaik/mosaik-ui"

const picture = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#8da4ef"/><circle cx="160" cy="90" r="48" fill="#fff" fill-opacity=".5"/></svg>',
)}`

export const App = () => <Image src={picture} alt="A circle on a blue background" width="80" borderRadius="l3" />
