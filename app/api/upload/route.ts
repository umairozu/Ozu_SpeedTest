
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function errorResponse(
  message: string,
  status = 400
): Response {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  );
}

export async function POST(request: Request): Promise<Response> {

  const preProcessingStartedAt = performance.now();
  const url = new URL(request.url);

  const rawExpectedBytes = url.searchParams.get('bytes');

  if (rawExpectedBytes === null || !/^\d+$/.test(rawExpectedBytes)) {
    return errorResponse('The bytes query parameter must be a positive integer.');
  }

  const expectedBytes = Number(rawExpectedBytes);

  if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0) {
    return errorResponse('The bytes query parameter must be a positive integer.');
  }

  if (expectedBytes > MAX_UPLOAD_BYTES) {
    return errorResponse(`The maximum upload size is ${MAX_UPLOAD_BYTES} bytes.`, 413);
  }

  const contentType = request.headers
    .get('Content-Type')
    ?.split(';')[0]
    .trim();

  if (contentType !== 'application/octet-stream') {
    return errorResponse('Content-Type must be application/octet-stream.', 415);
  }

  const contentLengthHeader = request.headers.get('Content-Length');

  if (contentLengthHeader !== null) {
    const contentLength =  Number(contentLengthHeader);

    if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
      return errorResponse('Content-Length must be a positive integer.');
    }

    if (contentLength > MAX_UPLOAD_BYTES) {
      return errorResponse(`The maximum upload size is ${MAX_UPLOAD_BYTES} bytes.`, 413);
    }

    if (contentLength !== expectedBytes) {
      return errorResponse('Content-Length does not match the requested byte count.');
    }
  }



  const preProcessingMs = performance.now() - preProcessingStartedAt;
  // Wait until the complete upload body has been received.
  const body = await request.arrayBuffer();



  const postProcessingStartedAt = performance.now();


  const receivedBytes = body.byteLength;
  if (receivedBytes !== expectedBytes) {
    return errorResponse(`Expected ${expectedBytes} bytes but received ${receivedBytes} bytes.`);
  }


  const postProcessingMs = performance.now() - postProcessingStartedAt;

  const serverProcessingMs = preProcessingMs + postProcessingMs;

  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
      'Server-Timing': `app;dur=${serverProcessingMs.toFixed(3)}`,
      'X-Received-Bytes': String(receivedBytes)
    }
  });
}