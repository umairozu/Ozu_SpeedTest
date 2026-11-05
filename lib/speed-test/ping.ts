
export type PingSample = {
  // Complete browser-to-server-to-browser time.
  roundTripMs: number;
  // Time reported by the API route through Server-Timing.
  serverProcessingMs: number;
  // Estimated network time after server work is removed.
  networkPingMs: number;
};


export type PingMeasurement = {
  roundTripMs: number;
  serverProcessingMs: number;
  networkPingMs: number;
  samples: PingSample[];
};


/**
 * Read one duration metric from a Server-Timing header.
 * Example: Server-Timing: app;dur=2.47
 */
export const getServerTimingDuration = (response: Response, metricName = 'app'): number | undefined => {
  const header = response.headers.get('server-timing');
  if (!header) return undefined;

  for (const metric of header.split(',')) {
    const parts = metric.split(';').map(part => part.trim());
    if (parts[0].toLowerCase() !== metricName.toLowerCase()) continue;

    const durationPart = parts.find(part => /^dur=/i.test(part));
    if (!durationPart) return undefined;

    const duration = Number(durationPart.slice(durationPart.indexOf('=') + 1));
    return Number.isFinite(duration) && duration >= 0 ? duration : undefined;
  }

  return undefined;
};




async function measureOnePing(): Promise<PingSample> {
  // One sample represents one complete HTTP request and response.
  const url = new URL('/api/ping', window.location.href);

  // Make every request unique so it cannot be reused from a cache.
  url.searchParams.set('_speedtest', `${Date.now()}-${Math.random()}`);

  const startedAt = performance.now();

  // no-store asks the browser to contact the API instead of using a cached response.
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store'
  });

  const endedAt = performance.now();

  if (!response.ok) {
    throw new Error(`Ping request failed: ${response.status}`);
  }

  const roundTripMs = endedAt - startedAt;

  const serverProcessingMs = getServerTimingDuration(response, 'app') ?? 0;

  // Estimate network latency by removing the server's reported processing time.
  const networkPingMs = Math.max(0, roundTripMs - serverProcessingMs);

  return {
    roundTripMs,
    serverProcessingMs,
    networkPingMs
  };
}




//Take the median of the sample 
function calculateMedian(values: number[]): number {
  const sorted = [...values].sort((first, second) => first - second);

  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

//optional function
function calculateLowest(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.min(...values);
}



export async function measurePing(sampleCount = 19): Promise<PingMeasurement> {
  // Several samples reduce the effect of one temporarily slow request.
  if (!Number.isSafeInteger(sampleCount) || sampleCount < 1 || sampleCount > 20) {
    throw new RangeError('sampleCount must be an integer between 1 and 20.');
  }

  // Ignore one warm-up request. It may include connection
  // establishment or a server cold start.
  await measureOnePing();
  await measureOnePing();

  const samples: PingSample[] = [];

  // Ping requests should be sequential, not concurrent.
  for (let index = 0; index < sampleCount; index += 1) {
    samples.push(await measureOnePing());
  }

  return {
    // Use the median sample to represent the observed round trip.
    roundTripMs:calculateMedian(samples.map(sample => sample.roundTripMs)),

    serverProcessingMs: calculateMedian(samples.map(sample => sample.serverProcessingMs)),

    networkPingMs: calculateMedian(samples.map(sample => sample.networkPingMs)),

    samples
  };
}
