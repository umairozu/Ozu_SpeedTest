
import { randomFillSync } from 'node:crypto';


const MAX_DOWNLOAD_BYTES = 4 * 1024 * 1024;

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
  const processingStartedAt = performance.now();

  const url = new URL(request.url);
  const rawBytes = url.searchParams.get('bytes');

  if (rawBytes === null || !/^\d+$/.test(rawBytes)) {
    return badRequest('The bytes query parameter must be a positive integer.');
  }

  const requestedBytes = Number(rawBytes);

  if (!Number.isSafeInteger(requestedBytes) ||  requestedBytes <= 0) {
    return badRequest('The bytes query parameter must be a positive integer.');
  }

  if (requestedBytes > MAX_DOWNLOAD_BYTES) {
    return badRequest(`The maximum download size is ${MAX_DOWNLOAD_BYTES} bytes.`);
  }

  const body = new Uint8Array(requestedBytes);

  randomFillSync(body);

  const processingMs =   performance.now() - processingStartedAt;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(body.byteLength),
      'Content-Encoding': 'identity',
      'Cache-Control': 'no-store, no-transform',
      'Server-Timing': `app;dur=${processingMs.toFixed(3)}`,
    }
  });
}