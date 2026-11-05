


/**
 * Ping API flow:
 * 1. Record when this route starts processing.
 * 2. Return an empty response as quickly as possible.
 * 3. Tell the browser how much of the round trip was server work.
 */
export function GET() {
  // Return an empty response so the client mainly measures request latency.
  const processingStartedAt = performance.now();
  const serverTimeMs = Date.now();
  const processingMs = performance.now() - processingStartedAt;

  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store, no-transform',
      // Let the client remove time spent inside this route from the round trip.
      'Server-Timing': `app;dur=${processingMs.toFixed(3)}`,
    }
  });
}


