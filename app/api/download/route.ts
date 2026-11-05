
import { randomFillSync } from 'node:crypto';


// This route sends binary data to the browser for one download measurement.
// Limit each response to 4 MiB to keep the endpoint predictable.
const MAX_DOWNLOAD_BYTES = 4 * 1024 * 1024;

// Return a consistent JSON error when the requested size is invalid.
function badRequest(message: string): Response {
  return Response.json(
    {
      error: message
    },
    {
      status: 400,
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  );
}

export function GET(request: Request): Response {
  // Start timing before validating and creating the response body.
  const processingStartedAt = performance.now();

  // The client chooses the payload size through the bytes query parameter.
  const url = new URL(request.url);
  const rawBytes = url.searchParams.get('bytes');

  if (rawBytes === null || !/^\d+$/.test(rawBytes)) {
    return badRequest('The bytes query parameter must be a positive integer.');
  }

  const requestedBytes = Number(rawBytes);

  // Only accept whole byte counts within the endpoint's safety limit.
  if (!Number.isSafeInteger(requestedBytes) ||  requestedBytes <= 0) {
    return badRequest('The bytes query parameter must be a positive integer.');
  }

  if (requestedBytes > MAX_DOWNLOAD_BYTES) {
    return badRequest(`The maximum download size is ${MAX_DOWNLOAD_BYTES} bytes.`);
  }

  const body = new Uint8Array(requestedBytes);

  // Random data resists compression, so the transferred size stays realistic.
  randomFillSync(body);

  const processingMs =   performance.now() - processingStartedAt;

  // The browser will read this entire response and measure how long it takes.
  return new Response(body, {
    status: 200,
    headers: {
      // Send raw binary data with no compression, transformation, or caching.
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(body.byteLength),
      'Content-Encoding': 'identity',
      'Cache-Control': 'no-store, no-transform',
      'Server-Timing': `app;dur=${processingMs.toFixed(3)}`,
    }
  });
}
