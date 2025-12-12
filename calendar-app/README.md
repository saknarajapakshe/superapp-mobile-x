# Calendar App

A pure frontend calendar application displaying Sri Lankan public holidays with custom event management.

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Features

- 📅 Monthly calendar view
- 🇱🇰 Sri Lankan public holidays (auto-fetched)
- ➕ Create custom events with title, description, time, and color
- 🗑️ Delete events
- 💾 Offline-first with localStorage caching (7 days)
- 📱 Fully responsive

## Tech Stack

- React 19 + TypeScript
- Tailwind CSS
- date-fns
- Vite
- Native Fetch API

## How It Works

1. Fetches holidays from `https://www.officeholidays.com/ics-clean/sri-lanka` via CORS proxy
2. Parses ICS calendar format
3. Caches in localStorage for 7 days
4. User events stored locally in browser

## Build

```bash
npm run build
```

Creates a single-file build in `dist/index.html` ready for deployment or microapp integration.

## Project Structure

```
frontend/
├── components/       # UI components (EventModal, UI primitives)
├── hooks/           # useCalendar hook
├── services/        # holidayService, eventService
├── views/           # CalendarView
├── App.tsx          # Main app
└── types.ts         # TypeScript interfaces
```

## No Backend Required

Everything runs in the browser. No server setup needed.
