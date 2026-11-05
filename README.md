# Ozu SpeedTest

**Live website:** [https://ozu-speed-test.vercel.app/](https://ozu-speed-test.vercel.app/)

Ozu SpeedTest is a browser-based application that measures:

- Ping in milliseconds
- Download speed in Mbps
- Upload speed in Mbps
- Bytes transferred during download and upload

The project uses Next.js, React, TypeScript, Node.js, and Vercel.

## System Requirements

- Node.js 20.9.0 or newer
- npm, included with Node.js

No database, API key, or additional service is required.

## Download the Project

Clone the GitHub repository:

```bash
git clone https://github.com/umairozu/Ozu_SpeedTest.git
cd Ozu_SpeedTest
```

Install the required dependencies:

```bash
npm install
```

## Run in Development Mode

Start the local development server:

```bash
npm run dev
```

Open the following address in your browser:

```text
http://localhost:3000
```

Changes made to the project files will normally appear automatically while the development server is running.

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/ping` | `GET` | Measures HTTP response latency |
| `/api/download` | `GET` | Returns binary data for download testing |
| `/api/upload` | `POST` | Receives binary data for upload testing |

## Project Structure

```text
app/
├── api/
│   ├── ping/
│   │   └── route.ts
│   ├── download/
│   │   └── route.ts
│   └── upload/
│       └── route.ts
├── components/
│   └── speed-test.tsx
├── globals.css
├── layout.tsx
└── page.tsx

lib/
└── speed-test/
    ├── ping.ts
    ├── download.ts
    └── upload.ts

public/
└── speedtest-meter.svg
```

## Important Notes

- Testing on `localhost` measures communication with your own computer, not the deployed Vercel server.
- Use the live website to measure performance against the deployed server.
- Payload sizes are selected randomly, so the number of transferred bytes may change between tests.
- Results can vary because of Wi-Fi quality, network congestion, VPN usage, browser activity, server load, and physical distance from the server.
- The application measures HTTP performance and may not exactly match commercial speed-testing services.
- Running a speed test consumes network data because real binary payloads are downloaded and uploaded.
