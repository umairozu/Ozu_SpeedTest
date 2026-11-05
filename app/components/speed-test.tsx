'use client';

import Image from 'next/image';
import { useState } from 'react';

import { DownloadTest } from '../../lib/speed-test/download';
import { measurePing } from '../../lib/speed-test/ping';
import { UploadTest } from '../../lib/speed-test/upload';

type MeterName = 'download' | 'upload' | 'ping';

type MeterConfig = {
  name: MeterName;
  label: string;
  description: string;
  unit: 'Mbps' | 'ms';
};


type TestPhase = 'idle'| 'ping'| 'download'| 'upload'| 'complete'| 'error';

type TestResults = Record<MeterName, number | null>;

// Download and upload report transferred bytes in addition to their speeds.
type TransferredBytes = {
  download: number | null;
  upload: number | null;
};

const REQUEST_COUNT = 1;

const SERVER_LOCATION = 'Frankfurt, Germany';

const METERS: readonly MeterConfig[] = [
  {
    name: 'download',
    label: 'DOWNLOAD',
    description: 'Incoming speed',
    unit: 'Mbps'
  },
  {
    name: 'upload',
    label: 'UPLOAD',
    description: 'Outgoing speed',
    unit: 'Mbps'
  },
  {
    name: 'ping',
    label: 'PING',
    description: 'Response time',
    unit: 'ms'
  }
];



function createEmptyResults(): TestResults {
  return {
    download: null,
    upload: null,
    ping: null
  };
}



function getStatusMessage(phase: TestPhase, error: string | null): string {
  // Convert the current test phase into a message shown below the button.
  switch (phase) {
    case 'ping':
      return 'Measuring ping...';

    case 'download':
      return 'Measuring download speed...';

    case 'upload':
      return 'Measuring upload speed...';

    case 'complete':
      return 'Speed test complete.';

    case 'error':
      return error ?? 'The speed test failed.';

    default:
      return `Server Location: ${SERVER_LOCATION}`;
  }
}





function Meter({config, value,transferredBytes}: {config: MeterConfig; value: number | null; transferredBytes?: number | null;}) {
  // Ping uses one decimal place; download and upload use two.
  const displayedValue = value === null  ? '--' : value.toFixed(config.name === 'ping' ? 1 : 2);

  return (
    <article className="meter">
      <div className="dial">
        <div
          className="dial-reading"
          aria-live="polite"
        >
          <span>{displayedValue}</span>
          <p>{config.unit}</p>
        </div>
      </div>
            {transferredBytes !== null && transferredBytes !== undefined && (
            <p className='transferred-bytes'> {transferredBytes.toLocaleString()} bytes transferred</p> )}

    <h2 >{config.label}</h2>
    <p>{config.description}</p>

    </article>
  );
}






export default function SpeedTest() {
  // phase controls the status text, disabled button, and current test step.
  const [phase, setPhase] = useState<TestPhase>('idle');

  // Results start as null so each meter displays -- before a test completes.
  const [results, setResults] = useState<TestResults>(createEmptyResults);

  const [error, setError] = useState<string | null>(null);

  const [transferredBytes, setTransferredBytes] = useState<TransferredBytes>({download: null, upload: null});

  const isRunning =
    phase === 'ping' ||
    phase === 'download' ||
    phase === 'upload';

  async function handleCheck(): Promise<void> {
    // Ignore extra clicks while a test is already running.
    if (isRunning) {
      return;
    }

    setError(null);
    // Clear the previous run before starting a new sequence.
    setResults(createEmptyResults());
    setTransferredBytes({download: null, upload: null});

    try {

      //Ping value retrieval and setup
      setPhase('ping');
      const pingMeasurement = await measurePing();
      setResults(currentResults => ({...currentResults, ping: pingMeasurement.networkPingMs}));



      //Download data retrieval and setup
      setPhase('download');

      const downloadTest = new DownloadTest('/api/download');

      const downloadMeasurement = await downloadTest.measureBatch(
          undefined,
          REQUEST_COUNT
        );
      setTransferredBytes(current => ({...current, download: downloadMeasurement.totalBytes}));
      setResults(currentResults => ({...currentResults, download: downloadMeasurement.megabitsPerSecond}));




      //Upload data retrieval and setup
      setPhase('upload');

      const uploadTest = new UploadTest('/api/upload');

      const uploadMeasurement =
        await uploadTest.measureBatch(
          undefined,
          REQUEST_COUNT,
          pingMeasurement.networkPingMs
        );
      setTransferredBytes(current => ({...current, upload: uploadMeasurement.totalBytes}));
      setResults(currentResults => ({...currentResults, upload: uploadMeasurement.megabitsPerSecond}));



      setPhase('complete');
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'An unexpected speed-test error occurred.';

      setError(message);
      setPhase('error');
    }
  }



 const statusMessage = getStatusMessage(phase, error);

  return (
    <main className="speedtest-shell">
      <header className="title-block">
        <Image
          className="speedtest-logo"
          src="/speedtest-meter.svg"
          alt=""
          aria-hidden="true"
          width={20}
          height={50}
        />

        <h1>OZU SPEED TEST</h1>
      </header>

      <section
        className="meters"
        aria-label="Speed test measurements"
      >
        {METERS.map(meter => (
          <Meter
            key={meter.name}
            config={meter}
            value={results[meter.name]}
            transferredBytes={
                              meter.name === 'download' ? transferredBytes.download
                                                        : meter.name === 'upload' ? transferredBytes.upload
                                                        : null
                              }
          />
        ))}
      </section>

      <section
        className="controls"
        aria-label="Speed test controls"
      >
        <button
          id="check-button"
          className={
            `check-button${
              isRunning ? ' check-button--running' : ''
            }`
          }
          type="button"
          disabled={isRunning}
          aria-busy={isRunning}
          onClick={handleCheck}
        >
          <span
            className="check-dot"
            aria-hidden="true"
          />

          <span>{isRunning ? 'TESTING' : 'CHECK'}</span>
        </button>

        <p
          className="test-status"
          aria-live={
            phase === 'error' ? 'assertive' : 'polite'
          }
        >
          {statusMessage}
        </p>
      </section>
    </main>
  );



}




