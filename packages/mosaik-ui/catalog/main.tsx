import { render } from "solid-js/web"
import { Catalog } from "./catalog"
import "./styles.css"

const root = document.getElementById("root")
if (root) render(() => <Catalog />, root)
