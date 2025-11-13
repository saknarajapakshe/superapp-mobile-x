# Frontend

React + TypeScript frontend for the Memo App. Uses Vite and Tailwind styles.

## Quick start

```bash
# Install
npm install

# Create .env from example if needed
cp .env.example .env

# Run development server
npm run dev
```

Open the app in your browser at the Vite dev URL (usually `http://localhost:5173`).

## Important environment variables

- `VITE_API_URL` — Backend API base URL (default: `http://localhost:8080/api`)
- `VITE_POLL_INTERVAL_MS` — Poll interval for received memos in milliseconds (default provided in `frontend/src/constants.ts`)

## Project structure (important files)

```
frontend/
├── src/
│   ├── App.tsx                 # Main UI wiring: tabs, polling and refresh actions
│   ├── api.ts                  # REST API wrapper used by hooks
│   ├── hooks/
│   │   ├── useMemos.ts         # Sent/Received memo logic and submitMemo
│   │   └── useUser.ts          # Bridge + token utilities
│   ├── components/
│   │   ├── MemoForm.tsx        # Compose memo UI (calls useMemos.submitMemo)
│   │   └── MemoList.tsx        # Reusable list + load-more button
│   ├── constants.ts            # UI text and configuration
│   └── bridge.ts               # Bridge shim (window.microAppBridge) used at runtime
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Features & behavior

- Send memos to other users by email identifier (no external email delivery).
- Received memos are persisted via the microapp bridge (`window.microAppBridge`) if available; otherwise localStorage is used for development.
- Real-time updates are implemented with polling (SSE was removed due to platform instability).
- TTL semantics:
	- Leaving TTL empty defaults to 1 day.
	- Choosing "Keep forever" sends no TTL (nil) and backend stores it as "forever".
- Notifications are shown using a small dot.
- Pagination: Sent and Received lists support a simple "Load more" (page + limit) UI. The frontend uses `useMemos` to fetch pages.

## Bridge expectations

The app expects a `window.microAppBridge` with these methods (development falls back to localStorage):

- `getToken(): Promise<{ email: string }>` — returns user identity from token
- `saveMemo(memo: ReceivedMemo): Promise<void>` — persist a received memo
- `getSavedMemos(): Promise<ReceivedMemo[]>` — read saved memos
- `deleteMemo(id: string): Promise<void>` — delete a saved memo
- `showAlert(title: string, message?: string)` — show alert to user (optional)

See `frontend/src/bridge.ts` for a shim implementation used in dev.

## How to run build

```bash
npm run build
```

Resulting build is under `dist/`.

## Where the logic lives

- API client: `src/api.ts`
- Memo state + side-effects: `src/hooks/useMemos.ts`
- Memo form UI: `src/components/MemoForm.tsx`
- Constants: `src/constants.ts`

## Troubleshooting

- If Received tab is empty: press the Refresh button. The UI polls automatically when the tab is active, but you can force a refresh.
- If the frontend can't reach the backend, set `VITE_API_URL` to the correct value and restart the dev server.
