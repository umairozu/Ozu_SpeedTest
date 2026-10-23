
type PingResult = {
  roundTripMs: number;
  serverProcessingMs: number;
  networkPingMs: number;
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

async function measureOnePing(): Promise<PingResult> {
  const url = new URL('/api/ping');

  url.searchParams.set('_speedtest', `${Date.now()}-${Math.random()}`);

  const startedAt = performance.now();

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

  const networkPingMs = Math.max(0, roundTripMs - serverProcessingMs);

  return {
    roundTripMs,
    serverProcessingMs,
    networkPingMs
  };
}