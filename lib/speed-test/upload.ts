
export type UploadMeasurement = {
  requestedBytes: number;
  receivedBytes: number;

  requestToResponseMs: number;
  serverProcessingMs: number;
  pingMs: number;
  uploadDurationMs: number;

  megabitsPerSecond: number;
  timingSource: 'resource' | 'wall-clock';

  requestStartMs?: number;
  finalResponseStartMs?: number;
};

export type UploadBatchMeasurement = {
  requestCount: number;
  bytesPerRequest: number;
  totalBytes: number;
  durationMs: number;
  megabitsPerSecond: number;
  timingSource: 'resource' | 'wall-clock';
  measurements: UploadMeasurement[];
};



type InterimAwareTiming = PerformanceResourceTiming & {
  finalResponseHeadersStart?: number;
};



const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const RANDOM_CHUNK_SIZE = 65_536;

function createRandomPayload(requestedBytes: number): Uint8Array {
  const payload = new Uint8Array(requestedBytes);

  for (let offset = 0; offset < requestedBytes; offset += RANDOM_CHUNK_SIZE) {
    const end = Math.min(offset + RANDOM_CHUNK_SIZE, requestedBytes);
    crypto.getRandomValues(payload.subarray(offset, end));
  }
  return payload;
}




function getServerTimingDuration(response: Response, metricName = 'app'): number | undefined {
  const header = response.headers.get('Server-Timing');

  if (!header) {
    return undefined;
  }

  const metrics = header.split(',');

  for (const metric of metrics) {
    const [name, ...parameters] = metric.trim().split(';');

    if (name !== metricName) {
      continue;
    }

    const durationParameter = parameters.find(parameter => parameter.trim().startsWith('dur='));

    if (!durationParameter) {
      return undefined;
    }

    const duration = Number(durationParameter.trim().slice('dur='.length));
    

    return Number.isFinite(duration) ? duration : undefined;
  }
  return undefined;
}




function getResourceTiming(resourceUrl: string): InterimAwareTiming | undefined {
  const entries = performance.getEntriesByName(resourceUrl, 'resource');

  return entries[entries.length - 1] as InterimAwareTiming | undefined;
}





function getFinalResponseStart(timing: InterimAwareTiming): number {
  if (timing.finalResponseHeadersStart !== undefined &&  timing.finalResponseHeadersStart > 0) {
    return timing.finalResponseHeadersStart;
  }
  return timing.responseStart;
}




export class UploadTest {
  constructor(
    private readonly endpoint = '/api/upload'
  ) {}

  async measure(requestedBytes: number, pingMs = 0): Promise<UploadMeasurement> {

    if (!Number.isSafeInteger(requestedBytes) || requestedBytes <= 0 || requestedBytes > MAX_UPLOAD_BYTES) {
      throw new RangeError(`requestedBytes must be an integer between 1 and ${MAX_UPLOAD_BYTES}.`);
    }

    if (!Number.isFinite(pingMs) || pingMs < 0) {
      throw new RangeError('pingMs must be a non-negative number.');
    }

    // Generate the payload before starting the timer.
    const payload =  createRandomPayload(requestedBytes);
    const url = new URL(this.endpoint, window.location.href);

    url.searchParams.set('bytes', String(requestedBytes));
    url.searchParams.set('_speedtest', `${Date.now()}-${Math.random()}`);

    const wallClockStartedAt = performance.now();

    const response = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: {
            'Content-Type':
            'application/octet-stream'
        },
        body: payload.buffer as ArrayBuffer,
    });

    const wallClockFinishedAt =  performance.now();

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Upload request failed with status ${response.status}.`);
    }



    const receivedBytesHeader =  response.headers.get('X-Received-Bytes');
    const receivedBytes = Number(receivedBytesHeader);


    if (!Number.isSafeInteger(receivedBytes) ||  receivedBytes !== requestedBytes) {
      throw new Error(`Expected the server to receive ${requestedBytes} bytes, but it reported ${receivedBytesHeader}.`);
    }

    const serverProcessingMs = getServerTimingDuration(response, 'app') ?? 0;

    const resourceTiming = getResourceTiming(url.href);
    

    let requestToResponseMs = wallClockFinishedAt - wallClockStartedAt;

    let timingSource: 'resource' | 'wall-clock' = 'wall-clock';

    let requestStartMs: number | undefined = wallClockStartedAt;

    let finalResponseStartMs: number | undefined = wallClockFinishedAt;

    if (resourceTiming) {
      const finalResponseStart = getFinalResponseStart(resourceTiming);

      const hasDetailedTiming = resourceTiming.requestStart > 0 && finalResponseStart >  resourceTiming.requestStart;

      if (hasDetailedTiming) {
        requestStartMs = resourceTiming.requestStart;
        finalResponseStartMs = finalResponseStart;

        requestToResponseMs = finalResponseStart - resourceTiming.requestStart;
        timingSource = 'resource';
      }
    }

    const uploadDurationMs = requestToResponseMs - serverProcessingMs - pingMs;

    if (uploadDurationMs <= 0) {
      throw new Error('The calculated upload duration was not positive. Try a larger payload or verify the ping measurement.');
    }

    const transferredBits = receivedBytes * 8;
    const durationSeconds = uploadDurationMs / 1000;
    const megabitsPerSecond = transferredBits / durationSeconds / 1_000_000;

    return {
      requestedBytes,
      receivedBytes,

      requestToResponseMs,
      serverProcessingMs,
      pingMs,
      uploadDurationMs,

      megabitsPerSecond,
      timingSource,

      requestStartMs,
      finalResponseStartMs
    };
  }







  async measureBatch(bytesPerRequest = MAX_UPLOAD_BYTES, requestCount = 4, pingMs = 0): Promise<UploadBatchMeasurement> {

    if (!Number.isSafeInteger(requestCount) || requestCount < 1 || requestCount > 6) {
      throw new RangeError('requestCount must be an integer between 1 and 6.');
    }

    if (!Number.isFinite(pingMs) || pingMs < 0) {
      throw new RangeError('pingMs must be a non-negative number.');
    }

    const measurements = await Promise.all(Array.from( { length: requestCount }, () => this.measure(bytesPerRequest, pingMs) ));

    const totalBytes = measurements.reduce((sum, measurement) => sum + measurement.receivedBytes, 0);

    const earliestUploadStart = Math.min( ...measurements.map(measurement => measurement.requestStartMs! + measurement.pingMs));

    const latestUploadEnd = Math.max( ...measurements.map(measurement => measurement.finalResponseStartMs! - measurement.serverProcessingMs));

    const durationMs = latestUploadEnd - earliestUploadStart;

    if (durationMs <= 0) {
      throw new Error('The measured upload batch duration was not valid.');
    }

    const megabitsPerSecond = (totalBytes * 8) / (durationMs / 1000) / 1_000_000;

    const timingSource = measurements.every(measurement => measurement.timingSource === 'resource') ? 'resource' : 'wall-clock';

    return {
      requestCount,
      bytesPerRequest,
      totalBytes,
      durationMs,
      megabitsPerSecond,
      timingSource,
      measurements
    };
  }
}
