import type { RequestId } from "../api"

/**
 * What the desk's notifications are about, which it resolves them by. One item per person per subject:
 * later notifications about it update that item instead of adding another.
 */

/** Being given a request, its deadline, replies on it: whoever handles it, until it is done or theirs no more. */
export const handlerSubject = (id: RequestId) => `request:${id}`

/** Replies to the person who asked: their conversation, theirs to clear. */
export const requesterSubject = (id: RequestId) => `request:${id}:requester`
