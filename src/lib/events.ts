import { EventEmitter } from "events";

/**
 * In-memory pub/sub for ticket updates.
 * Single-instance only — swap for Redis pub/sub if we horizontally scale.
 * Stored on globalThis so HMR reloads don't orphan listeners.
 */
type Bus = EventEmitter;
const g = globalThis as unknown as { __ticketBus?: Bus };
const bus: Bus = g.__ticketBus ?? new EventEmitter();
bus.setMaxListeners(0);
g.__ticketBus = bus;

export type TicketEvent =
  | { type: "message"; ticketId: string; message: unknown; isCustomer: boolean }
  | { type: "ticket_changed"; ticketId: string }
  | { type: "ticket_created"; ticketId: string };

const TICKET_CHANNEL = (id: string) => `ticket:${id}`;
const ADMIN_CHANNEL = "admin:all";

export function emitTicketEvent(event: TicketEvent) {
  bus.emit(TICKET_CHANNEL(event.ticketId), event);
  bus.emit(ADMIN_CHANNEL, event);
}

export function onTicketEvent(
  ticketId: string,
  handler: (event: TicketEvent) => void
): () => void {
  const channel = TICKET_CHANNEL(ticketId);
  bus.on(channel, handler);
  return () => bus.off(channel, handler);
}

export function onAdminEvent(
  handler: (event: TicketEvent) => void
): () => void {
  bus.on(ADMIN_CHANNEL, handler);
  return () => bus.off(ADMIN_CHANNEL, handler);
}
