'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

type MeterName = 'download' | 'upload' | 'ping';

type MeterConfig = {
  name: MeterName;
  label: string;
  description: string;
  unit: 'Mbps' | 'ms';
  activeSegments: number;
};

const SEGMENTS = Array.from({ length: 12 }, (_, index) => index);

const METERS: readonly MeterConfig[] = [
  {
    name: 'download',
    label: 'DOWNLOAD',
    description: 'Incoming speed',
    unit: 'Mbps',
    activeSegments: 7
  },
  {
    name: 'upload',
    label: 'UPLOAD',
    description: 'Outgoing speed',
    unit: 'Mbps',
    activeSegments: 5
  },
  {
    name: 'ping',
    label: 'PING',
    description: 'Response time',
    unit: 'ms',
    activeSegments: 6
  }
];

const SERVERS = [
  { value: 'fra1', label: 'Frankfurt, Germany' },
  { value: 'iad1', label: 'Washington, D.C., USA' },
  { value: 'sin1', label: 'Singapore' }
] as const;

function Meter({
  config,
  isChecking
}: {
  config: MeterConfig;
  isChecking: boolean;
}) {
  return (
    <article
      className={`meter meter--${config.name}${isChecking ? ' meter--scanning' : ''}`}
    >
      <div className="dial" aria-hidden="true">
        <div className="segments">
          {SEGMENTS.map(index => (
            <span
              className={`segment${index < config.activeSegments ? ' segment--accent' : ''}`}
              key={index}
              style={{ '--rotation': `${index * 30}deg` } as CSSProperties}
            />
          ))}
        </div>

        <div className="dial-reading">
          <span>--</span>
          <small>{config.unit}</small>
        </div>
      </div>

      <h2>{config.label}</h2>
      <p>{config.description}</p>
    </article>
  );
}

export default function SpeedTest() {
  const [serverCode, setServerCode] = useState<(typeof SERVERS)[number]['value']>(
    SERVERS[0].value
  );
  const [isChecking, setIsChecking] = useState(false);
  const resetTimer = useRef<number | null>(null);

  const selectedServer =
    SERVERS.find(server => server.value === serverCode) ?? SERVERS[0];

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
      }
    };
  }, []);

  const handleCheck = () => {
    if (resetTimer.current !== null) {
      window.clearTimeout(resetTimer.current);
    }

    setIsChecking(true);
    resetTimer.current = window.setTimeout(() => {
      setIsChecking(false);
      resetTimer.current = null;
    }, 1600);
  };

  return (
    <main className="speedtest-shell">
      <header className="title-block">
        <p className="brand">OZU</p>
        <h1>INTERNET SPEED TEST</h1>
        <p className="subtitle">Measure your connection to the selected server</p>
      </header>

      <section className="meters" aria-label="Speed test measurements">
        {METERS.map(meter => (
          <Meter config={meter} isChecking={isChecking} key={meter.name} />
        ))}
      </section>

      <section className="controls" aria-label="Speed test controls">
        <label className="server-control" htmlFor="server-select">
          <span>CHOOSE SERVER</span>
          <span className="select-shell">
            <span className="server-dot" aria-hidden="true" />
            <select
              id="server-select"
              name="server"
              value={serverCode}
              onChange={event =>
                setServerCode(event.target.value as (typeof SERVERS)[number]['value'])
              }
            >
              {SERVERS.map(server => (
                <option value={server.value} key={server.value}>
                  {server.label}
                </option>
              ))}
            </select>
          </span>
        </label>

        <button
          id="check-button"
          className={`check-button${isChecking ? ' check-button--running' : ''}`}
          type="button"
          disabled={isChecking}
          aria-busy={isChecking}
          onClick={handleCheck}
        >
          <span className="check-dot" aria-hidden="true" />
          <span>CHECK</span>
        </button>

        <p className="test-status" aria-live="polite">
          {isChecking
            ? 'Measurement API will connect here next'
            : `Ready - ${selectedServer.label} selected`}
        </p>
      </section>

      <p className="privacy-note">
        Test data only. No personal files are sent or stored.
      </p>
    </main>
  );
}
