# ApiArmor web (frontend only)

The ApiArmor frontend, built from *ApiArmor UI Screens* and *ApiArmor Complete Documentation*
(review §2 UX, §5 stack, Part 2 module specs, Part 3 QA cases).

**There is no backend.** All data is static (`src/data/`), and the scan engine, request
executor and ShopLab API are simulated in the browser. Your edits, triage decisions and scans
are stored in this browser's IndexedDB.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (scan planning, cURL parsing)
npm run build      # typecheck + production build
```

Needs Node 20.18+ (pinned to Vite 6 / Vitest 3 for that reason).

## Stack (per §5 "Final technology stack")

React 19 + TypeScript · Vite · Tailwind CSS v4 · Zustand (persisted to IndexedDB) ·
Radix UI (tabs, dialogs, menus, radio group, tooltips) · CodeMirror 6 (lazy-loaded) ·
react-resizable-panels · TanStack Virtual · React Router.

TanStack Query is not included: it manages server state, and with static data there is none.
Add it when the NestJS API exists, and move the reads in `src/store/app.ts` into query hooks.

## Screens

| Route | Screen |
| --- | --- |
| `/` | Home: demo API, paste cURL, import (Phase 2, disabled), checklist |
| `/collections/:id` | Request workspace: tree, tabs, editor, response; three resizable panes |
| `/groups` | Group list: every group as a card with API count, open findings, last scan |
| `/groups/:name` | One group: its APIs; add existing or new APIs (form or cURL), move, remove, tick and scan |
| `/scans/:id` | Live scan progress, cancel, findings as they're confirmed, history |
| `/findings` | Severity cards, filters (in the URL), group by category, virtualised list |
| `/findings/:id` | Evidence diff, explanation and fix, history, replay, mark as, copy as cURL |
| `/identities` | Test identities, sign-in test, environments, variables, safe mode |

Shortcuts: ⌘/Ctrl K command palette · ⌘/Ctrl Enter send · ⌘/Ctrl Shift Enter scan · ⌘/Ctrl S save.

## How the simulation behaves

- **Sending:** only `localhost:4000` (ShopLab) answers. Other localhost ports return *connection
  refused*, private IPs time out, and other hosts fail DNS. These are the error kinds the real
  executor reports.
- **Scanning:** `src/lib/scanPlan.ts` decides which of the seven MVP checks run, or why each is
  skipped, following the Part 2 specs (access expectation, second user, safe mode, Production).
  `src/lib/scanRunner.ts` then reports the planted flaws D-01 to D-13.
- **Fixing:** *Mark as Fixed* makes the static ShopLab treat that flaw as fixed. Replay or rescan
  then verifies it; choosing *Open* again brings it back.
- **Secrets:** passwords and tokens are never stored in the frontend. In the static build, a saved
  password of 8 or more characters "signs in"; a shorter one fails with 401.

## Where to plug in the backend

Replace `simulateSend` (`src/lib/shoplabResponder.ts`) and `startScan`/`cancelScan`
(`src/lib/scanRunner.ts`) with API calls plus SSE for progress. Keep `scanPlan.ts` as the
client-side preview; the shared `@apiarmor/schema` package from the review can supply the types in `src/types.ts`.
