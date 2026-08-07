# Tambola Ticket Generator

A SaaS application for designing custom Tambola (Housie / 90-ball Bingo) ticket templates, generating large batches of mathematically valid, unique tickets, and exporting them as PDF and image archives.

## Features

- **Design Studio** — Upload a background image and place 15 number zones using a grid overlay or free placement mode
- **Math Engine** — Generates tickets in books of 6 (the standard mathematically correct approach), guaranteeing every number 1–90 is used exactly once per book
- **Batch Generation** — Generate 10–5,000 unique tickets with real-time progress tracking
- **Export** — Multi-page PDF (4 tickets per A4 page) and ZIP of individual PNGs at 300 DPI
- **QR Verification** — Every ticket includes an HMAC-signed QR code linking to a public verification page
- **Template Reuse** — Save and reload custom designs

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TailwindCSS, Konva.js |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL 16, Prisma ORM |
| Queue | Redis 7, BullMQ |
| Real-time | Server-Sent Events (SSE) |
| PDF/Image | PDFKit, Sharp |

## Quick Start

### With Docker (recommended)

```bash
# Clone and start all services
cp .env.example .env
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health check: http://localhost:3001/api/health

### Without Docker

**Prerequisites:** Node.js 20+, PostgreSQL 16, Redis 7

```bash
# Backend
cd backend
cp ../.env.example .env   # edit DATABASE_URL and REDIS_URL
npm install
npx prisma migrate dev
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Environment Variables

See [`.env.example`](.env.example) for the full list of required configuration variables.

## Project Structure

```
tickets/
├── docker-compose.yml      # Local dev infrastructure
├── .env.example            # Environment variable documentation
├── backend/                # Express API + BullMQ workers
│   ├── prisma/             # Database schema & migrations
│   └── src/
│       ├── engine/         # Tambola math engine (book-of-6)
│       ├── routes/         # API endpoints
│       ├── middleware/      # Auth, rate limiting, error handling
│       ├── workers/        # Background job processors
│       ├── services/       # Business logic
│       └── utils/          # Helpers (HMAC, QR, etc.)
└── frontend/               # Next.js app
    └── src/
        ├── app/            # Pages (design studio, batch progress, verify)
        └── components/     # React components (canvas, UI, layout)
```

## License

Private — All rights reserved.
