import type { ConnectorError } from "@mosaik/connectors"
import { DeliveryFailure } from "./Channel"

/** Rejections (bad address, unknown channel, invalid payload) are permanent; everything else is retried. */
export const toDeliveryFailure = (error: ConnectorError) =>
  new DeliveryFailure({
    message: `${error.connector} ${error.reason}: ${error.message}`,
    permanent: error.reason === "BadRequest" || error.reason === "NotFound",
  })
