# 식사 일정

A mobile-first meal schedule viewer for restaurant staff — lets staff check today's menu and whether they're on the meal list for today, the week, or the month.

## Run & Operate

- `pnpm --filter @workspace/meal-schedule run dev` — run the web app (port 23573)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS (no backend needed)
- Data persistence: localStorage only (no database)
- Routing: tab-based state (no router needed)

## Where things live

- `artifacts/meal-schedule/src/App.tsx` — root with bottom tab navigation
- `artifacts/meal-schedule/src/pages/Today.tsx` — today's menu + user selection + meal status
- `artifacts/meal-schedule/src/pages/Week.tsx` — this week's schedule
- `artifacts/meal-schedule/src/pages/Month.tsx` — monthly calendar list view
- `artifacts/meal-schedule/src/pages/Admin.tsx` — paste Excel/Sheets data and save to localStorage
- `artifacts/meal-schedule/src/lib/storage.ts` — all localStorage read/write + parsing logic

## Architecture decisions

- No backend, no database — all data lives in localStorage
- Admin tab parses tab-separated text (copied from Excel/Google Sheets) into JSON saved to localStorage
- Tab changes dispatched via `window.dispatchEvent(new Event("meal-schedule-updated"))` so all tabs react instantly
- Dark mode always-on (no toggle) — `dark` class applied to `document.documentElement` on mount
- Mobile-first layout with fixed bottom nav and safe area insets

## Product

- **오늘**: Shows today's menu, lets staff pick their name, shows "오늘 식사 대상입니다" or "오늘은 식사 대상이 아닙니다"
- **이번주**: Week view with a card per day showing menu and per-user meal status
- **이번달**: Month list view with days highlighted when selected user has a meal
- **관리**: Admin paste screen — paste tab-separated data from Excel/Google Sheets and click 적용하기

## User preferences

- Korean UI text throughout
- Dark mode always on
- Mobile-first design inspired by Toss/Linear/Notion Calendar

## Gotchas

- Expected paste format: `date\tmenu\tusers` header row, then data rows with comma-separated names in the `users` column
- Header must use English column names: `date`, `menu`, `users`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
