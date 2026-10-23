/**
 * Download-speed measurement utilities for a browser application.
 *
 * The endpoint is expected to return exactly the number of bytes requested in
 * the `bytes` query parameter. For useful Resource Timing values on a
 * cross-origin endpoint, the server must also return a Timing-Allow-Origin
 * header.
 */

/** Resource Timing Level 3 fields not yet present in every TypeScript DOM lib. */
export type InterimAwareTiming = PerformanceResourceTiming & {
  finalResponseHeadersStart?: number;
  firstInterimResponseStart?: number;
};

export interface DownloadOptions {
  /** Extra options included in the GET request (for example, credentials). */
  fetchOptions?: RequestInit;
  /** Server-Timing metric to read, such as `app;dur=2.4`. */
  serverTimingMetric?: string;
  /** Used when the response does not contain a readable Server-Timing value. */
  estimatedServerTimeMs?: number;
  /** Optional correction for overhead not included in the server metric. */
  serverTimeDeltaMs?: number;
}

export interface DownloadResult {
  requestedBytes: number;
  downloadedBytes: number;
  /** Browser-reported wire size, including headers, when available. */
  transferSize: number;
  /** Time from requestStart until the final response headers arrive. */
  ttfbMs: number;
  /** Server processing time obtained from Server-Timing or the configured estimate. */
  serverTimeMs: number;
  /** Network portion of TTFB after removing server processing time. */
  pingMs: number;
  /** Time from final response headers until the last response byte. */
  payloadDownloadTimeMs: number;
  /** Time used as the denominator of the bandwidth calculation. */
  durationMs: number;
  bitsPerSecond: number;
  megabitsPerSecond: number;
}

const ESTIMATED_HEADER_FRACTION = 0.005;

export const getFinalResponseStart = (perf: InterimAwareTiming): number =>  perf.finalResponseHeadersStart || perf.responseStart;

export const getTtfb = (perf: InterimAwareTiming): number =>  getFinalResponseStart(perf) - perf.requestStart;

export const getPayloadDownloadTime = (perf: InterimAwareTiming): number =>  perf.responseEnd - getFinalResponseStart(perf);

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

/** Measure one download through the browser Fetch and Resource Timing APIs. */
export class Download {
  private readonly endpoint: string;
  private readonly fetchOptions: RequestInit;
  private readonly serverTimingMetric: string;
  private readonly estimatedServerTimeMs: number;
  private readonly serverTimeDeltaMs: number;

  constructor(endpoint: string, options: DownloadOptions = {}) {
    if (!endpoint) throw new Error('A download endpoint is required.');

    this.endpoint = endpoint;
    this.fetchOptions = options.fetchOptions ?? {};
    this.serverTimingMetric = options.serverTimingMetric ?? 'app';
    this.estimatedServerTimeMs = Math.max(0, options.estimatedServerTimeMs ?? 0);
    this.serverTimeDeltaMs = Math.max(0, options.serverTimeDeltaMs ?? 0);
  }

  async measure(requestedBytes: number): Promise<DownloadResult> {
    if (!Number.isSafeInteger(requestedBytes) || requestedBytes <= 0) {
      throw new RangeError('requestedBytes must be a positive safe integer.');
    }

    const url = new URL(this.endpoint, window.location.href);
    url.searchParams.set('bytes', String(requestedBytes));
    // This prevents cache reuse and identifies the Resource Timing entry.
    url.searchParams.set('_speedtest', `${Date.now()}-${Math.random()}`);

    const response = await fetch(url.href, {
      ...this.fetchOptions,
      method: 'GET',
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Download request failed with ${response.status} ${response.statusText}`);
    }

    const reportedServerTime = getServerTimingDuration(response, this.serverTimingMetric);

    // fetch() resolves when headers arrive. Reading the body waits for the
    // actual download to complete.
    const body = await response.arrayBuffer();
    const perf = performance
      .getEntriesByName(url.href, 'resource')
      .slice(-1)[0] as InterimAwareTiming | undefined;

    if (!perf) {
      throw new Error('The browser did not create a Resource Timing entry.');
    }

    const finalResponseStart = getFinalResponseStart(perf);
    if (perf.requestStart <= 0 || finalResponseStart <= 0) {
      throw new Error('Detailed response timing is unavailable. For a cross-origin endpoint, return an appropriate Timing-Allow-Origin header.');
    }

    const ttfbMs = getTtfb(perf);
    const payloadDownloadTimeMs = getPayloadDownloadTime(perf);
    const serverTimeMs = reportedServerTime ?? this.estimatedServerTimeMs;
    const pingMs = Math.max(0, ttfbMs - serverTimeMs - this.serverTimeDeltaMs);
    const durationMs = pingMs + payloadDownloadTimeMs;

    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      throw new Error('The browser reported an invalid download duration.');
    }

    const downloadedBytes = body.byteLength;
    const transferredBytes =  perf.transferSize ||  downloadedBytes * (1 + ESTIMATED_HEADER_FRACTION);
    const bitsPerSecond = (transferredBytes * 8) / (durationMs / 1000);

    return {
      requestedBytes,
      downloadedBytes,
      transferSize: perf.transferSize,
      ttfbMs,
      serverTimeMs,
      pingMs,
      payloadDownloadTimeMs,
      durationMs,
      bitsPerSecond,
      megabitsPerSecond: bitsPerSecond / 1_000_000
    };
  }
}

/**
 * Optional server helper for Fetch-compatible runtimes such as Cloudflare
 * Workers. It measures work completed before the Response is returned.
 */
export async function withServerTiming(request: Request, handler: (request: Request) => Promise<Response>, metricName = 'app'): Promise<Response> {
  const startedAt = performance.now();
  const originalResponse = await handler(request);
  const durationMs = performance.now() - startedAt;
  const headers = new Headers(originalResponse.headers);

  headers.append('Server-Timing', `${metricName};dur=${durationMs.toFixed(2)}`);

  return new Response(originalResponse.body, {
    status: originalResponse.status,
    statusText: originalResponse.statusText,
    headers
  });
}

export default Download;
