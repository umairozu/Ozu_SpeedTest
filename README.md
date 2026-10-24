# Ozu SpeedTest

Ozu SpeedTest is a simple web application that measures a user’s:

- Ping in milliseconds
- Download speed in Mbps
- Upload speed in Mbps

The project is built with Next.js, TypeScript, and Node.js, and deployed using Vercel.

## Run Locally

Make sure Node.js is installed, then run:

```bash
git clone https://github.com/umairozu/Ozu_SpeedTest.git
cd Ozu_SpeedTest
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## How It Works

### Ping

The browser sends several small requests to:

```text
/api/ping
```

The application measures the request round-trip time and displays the result in milliseconds.

### Download

The browser downloads multiple 4 MiB files concurrently from:

```text
/api/download
```

Download speed is calculated using:

```text
download speed = total downloaded bits / total duration
```

The result is converted to megabits per second:

```text
Mbps = (total bytes × 8) / duration in seconds / 1,000,000
```

### Upload

The browser generates random binary data and uploads multiple 4 MiB payloads concurrently to:

```text
/api/upload
```

Upload speed is calculated using:

```text
upload speed = total uploaded bits / upload duration
```

## Project Structure

```text
app/
├── api/
│   ├── ping/route.ts
│   ├── download/route.ts
│   └── upload/route.ts
├── components/
│   └── speed-test.tsx
├── globals.css
└── page.tsx

lib/
└── speed-test/
    ├── ping.ts
    ├── download.ts
    └── upload.ts
```

## Important Notes

- Localhost tests your local development server, not the Frankfurt server.
- The displayed ping is HTTP response time, so it may differ from Ookla or an operating-system ping command.
- Each complete test transfers approximately 16 MiB for download and 16 MiB for upload.
- Results can vary because of Wi-Fi, network congestion, browser activity, server load, VPN usage, and the selected server location.

## Technologies

- Next.js
- React
- TypeScript
- Node.js
- Vercel
