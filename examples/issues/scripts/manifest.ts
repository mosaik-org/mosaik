/** Writes mosaik-app.json (the manifest with the built bundle); the Portal reads it from the image. */
import { writeAppManifest } from "@mosaik/sdk/build/manifest"
import app from "../manifest"

const manifest = await writeAppManifest(app)
console.log(`mosaik-app.json: ${manifest.id} ${manifest.version} (platform ${manifest.platform})`)
