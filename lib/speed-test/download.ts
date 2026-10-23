
export type DownloadMeasurement = {
  requestedBytes: number;
  receivedBytes: number;
  ttfbMs: number;
  serverProcessingMs: number;
  pingMs: number;
  payloadDownloadMs: number;
  measurementDurationMs: number;
  megabitsPerSecond: number;

  finalResponseStartMs?: number;
  responseEndMs?: number;
};


export type DownloadBatchMeasurement = {
  requestCount: number;
  bytesPerRequest: number;
  totalBytes: number;
  durationMs: number;
  megabitsPerSecond: number;
  timingSource: 'resource' | 'wall-clock';
  measurements: DownloadMeasurement[];
};






type InterimAwareTiming = PerformanceResourceTiming & {
  finalResponseHeadersStart?: number;
};

const MAX_DOWNLOAD_BYTES = 4 * 1024 * 1024;

function getServerTimingDuration(response: Response,  metricName = 'app'): number | undefined {
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

    const durationParameter = parameters.find(parameter =>  parameter.trim().startsWith('dur='));

    if (!durationParameter) {
      return undefined;
    }

    const duration = Number(durationParameter.trim().slice('dur='.length));

    return Number.isFinite(duration) ? duration  : undefined;
  }

  return undefined;
}



function getResourceTiming(resourceUrl: string): InterimAwareTiming | undefined {

  const entries = performance.getEntriesByName(resourceUrl, 'resource');
  const lastEntry = entries[entries.length - 1];

  return lastEntry as InterimAwareTiming | undefined;
}



function getFinalResponseStart(timing: InterimAwareTiming): number {

  if (timing.finalResponseHeadersStart !== undefined && timing.finalResponseHeadersStart > 0) {
    return timing.finalResponseHeadersStart;
  }

  return timing.responseStart;
}




export class DownloadTest {
  constructor(
    private readonly endpoint = '/api/download' 
                ) {}

  async measure(requestedBytes: number): Promise<DownloadMeasurement> {

    let finalResponseStartMs: number | undefined;
    let responseEndMs: number | undefined;


    if (!Number.isSafeInteger(requestedBytes) ||  requestedBytes <= 0 ||  requestedBytes > MAX_DOWNLOAD_BYTES) {
      throw new RangeError(`requestedBytes must be an integer between 1 and ${MAX_DOWNLOAD_BYTES}.`);
    }

    const url = new URL(this.endpoint, window.location.href);

    url.searchParams.set('bytes', String(requestedBytes));
    url.searchParams.set('_speedtest', `${Date.now()}-${Math.random()}`);

    const requestStartedAt = performance.now();

    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store'
    });

    const responseHeadersReceivedAt =  performance.now();

    if (!response.ok) {
      const message = await response.text();

      throw new Error( message || `Download request failed with status ${response.status}.`);
    }

    const serverProcessingMs =   getServerTimingDuration(response, 'app') ?? 0;
    const responseBody = await response.arrayBuffer();
    const downloadFinishedAt = performance.now();
    const receivedBytes = responseBody.byteLength;

    if (receivedBytes !== requestedBytes) {
      throw new Error(`Expected ${requestedBytes} bytes but received ${receivedBytes} bytes.`);
    }

    const resourceTiming = getResourceTiming(url.href);

    let ttfbMs = responseHeadersReceivedAt - requestStartedAt;
    let payloadDownloadMs =  downloadFinishedAt -  responseHeadersReceivedAt;


    //More accurate and alternate way to get resource time if resourceTiming module is available
    //otherwise, the above can work too!!
    if (resourceTiming) {
      const finalResponseStart =  getFinalResponseStart(resourceTiming);
      const hasDetailedTiming =   resourceTiming.requestStart > 0 &&  finalResponseStart > 0 && 
                                  resourceTiming.responseEnd >= finalResponseStart;

      if (hasDetailedTiming) {
        finalResponseStartMs = finalResponseStart;
        responseEndMs = resourceTiming.responseEnd;

        ttfbMs =  finalResponseStart -  resourceTiming.requestStart;
        payloadDownloadMs = resourceTiming.responseEnd -  finalResponseStart;
      }
    }


    const pingMs = Math.max(0, ttfbMs - serverProcessingMs);
    const measurementDurationMs = pingMs + payloadDownloadMs;

    if (measurementDurationMs <= 0) {
      throw new Error('The measured download duration was not valid.');
    }

    const transferredBits = receivedBytes * 8;
    const durationSeconds = measurementDurationMs / 1000;
    const bitsPerSecond =   transferredBits / durationSeconds;
    const megabitsPerSecond = bitsPerSecond / 1_000_000;

    return {
      requestedBytes,
      receivedBytes,
      ttfbMs,
      serverProcessingMs,
      pingMs,
      payloadDownloadMs,
      measurementDurationMs,
      megabitsPerSecond,

      finalResponseStartMs,
      responseEndMs
    };
  }




    //for multiple batch processing of max 4 Kib
    async measureBatch(bytesPerRequest = 4 * 1024 * 1024, requestCount = 4): Promise<DownloadBatchMeasurement> {

    if (!Number.isSafeInteger(requestCount) || requestCount < 1 || requestCount > 6) {
        throw new RangeError('requestCount must be an integer between 1 and 6.');
    }

    const batchStartedAt = performance.now();

    const measurements = await Promise.all(
                                            Array.from( { length: requestCount }, () => this.measure(bytesPerRequest) )
    );

    const batchFinishedAt = performance.now();

    const totalBytes = measurements.reduce( (sum, measurement) =>  sum + measurement.receivedBytes, 0 );
    const hasResourceTiming = measurements.every( measurement => measurement.finalResponseStartMs !== undefined &&
                                                                 measurement.responseEndMs !== undefined
    );

    let durationMs: number;
    let timingSource: 'resource' | 'wall-clock';

    if (hasResourceTiming) {
        const earliestResponseStart = Math.min( ...measurements.map(measurement => measurement.finalResponseStartMs!) );
        const latestResponseEnd = Math.max( ...measurements.map(measurement => measurement.responseEndMs!) );

        durationMs = latestResponseEnd - earliestResponseStart;
        timingSource = 'resource';

    } else {
        durationMs = batchFinishedAt - batchStartedAt;
        timingSource = 'wall-clock';

    }

    if (durationMs <= 0) {
        throw new Error('The measured batch duration was not valid.');
    }

    const transferredBits = totalBytes * 8;
    const durationSeconds = durationMs / 1000;

    const megabitsPerSecond = transferredBits / durationSeconds / 1_000_000;

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