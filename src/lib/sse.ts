/**
 * Build a Server-Sent Events Response that relays events from our in-memory bus.
 * The caller passes a `subscribe` function that wires handlers to the bus and
 * returns an unsubscribe fn.
 */
export function sseResponse(
  subscribe: (send: (data: unknown) => void) => () => void
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      // Initial handshake + hint to the client we're live
      write(`retry: 3000\n\n`);
      write(`event: ready\ndata: {}\n\n`);

      const send = (data: unknown) => {
        write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const unsubscribe = subscribe(send);

      // Keep-alive ping every 25s so intermediate proxies don't drop idle connections
      const ping = setInterval(() => write(`:ping\n\n`), 25000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      // Will be triggered when the client disconnects
      const signal = (controller as unknown as { signal?: AbortSignal }).signal;
      if (signal) {
        signal.addEventListener("abort", cleanup);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable proxy buffering (Nginx/Caddy)
    },
  });
}
