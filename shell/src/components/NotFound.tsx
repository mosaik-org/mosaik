import { css } from "@mosaik/styled-system/css"
import { Button, EmptyState } from "@mosaik/ui"
import { Link, useLocation } from "@tanstack/solid-router"
import FileQuestion from "lucide-solid/icons/file-question-mark"
import { appForPath, appHref } from "../apps"

/**
 * The router's "not found" page. It renders inside the deepest layout of the URL: an
 * unknown page of an app keeps the shell and the app's navigation.
 */
export function NotFound() {
  const app = appForPath(useLocation()().pathname)
  return (
    <div class={css({ py: "16" })}>
      <EmptyState
        icon={<FileQuestion size={32} />}
        title="Page not found"
        description="The page you are looking for does not exist."
        action={
          <Link to={app === undefined ? "/" : appHref(app)}>
            <Button variant="outline">{app === undefined ? "Back to Overview" : `Back to ${app.name}`}</Button>
          </Link>
        }
      />
    </div>
  )
}
