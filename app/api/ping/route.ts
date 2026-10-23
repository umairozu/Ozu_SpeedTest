


export function GET() {
  const processingStartedAt = performance.now();
  const serverTimeMs = Date.now();
  const processingMs = performance.now() - processingStartedAt;

  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store, no-transform',
      'Server-Timing': `app;dur=${processingMs.toFixed(3)}`,
    }
  });
}




