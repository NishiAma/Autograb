# Vehicle Selection Form

A React + TypeScript form for choosing a vehicle (Make → Model → Badge) and uploading its service logbook as a plain text file. A Node.js + Express API supplies the vehicle data, validates the submission and returns the vehicle together with the logbook contents, which the page then displays.

## Contents

1. [Overview](#overview)
2. [Technology stack](#technology-stack)
3. [Architecture](#architecture)
4. [Project structure](#project-structure)
5. [Prerequisites](#prerequisites)
6. [Installation](#installation)
7. [Running the backend](#running-the-backend)
8. [Running the frontend](#running-the-frontend)
9. [Running tests and checks](#running-tests-and-checks)
10. [API reference](#api-reference)
11. [Example request and response](#example-request-and-response)
12. [Implementation decisions and trade-offs](#implementation-decisions-and-trade-offs)

## Overview

- **Dependent dropdowns.** The Model dropdown unlocks once a Make is chosen, and the Badge dropdown once a Model is chosen. When a parent selection changes, everything below it is cleared (child selections, the chosen file, the previous result) and the right options are loaded.
- **Quick-select buttons.** *Ford Ranger Raptor*, *Tesla Model 3 Performance* and *BMW 130d xDrive 26d* fill in all three dropdowns at once.
- **Logbook upload.** The upload unlocks once a Badge is chosen. It accepts `.txt` files up to 1 MB and checks them in the browser, then again on the server.
- **Submission.** The form posts `multipart/form-data` to the API. The result shows the success message, the vehicle details and the logbook contents as plain text.

## Technology stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, native form elements, plain CSS, Fetch API |
| Backend | Node.js, Express 5, TypeScript, Multer (memory storage) |
| Tests | Vitest + React Testing Library + user-event (client); Vitest + Supertest (server) |

## Architecture

```
Browser (React)  ──/api/*──▶  Vite dev/preview proxy  ──▶  Express API
                                                            ├─ /api/vehicles/*   → vehicleService → data/vehicles.ts
                                                            └─ /api/submissions  → multer (memory) → validation → logbookService
```

- **The vehicle data lives in one place:** `server/src/data/vehicles.ts`. The client never hard-codes the catalogue. It fetches makes, models and badges from the API.
- **All client form state lives in one hook:** `useVehicleForm`. Components only render and forward events.
- **All network calls go through one module:** `services/api.ts`. It returns typed data or throws a typed `ApiError`.
- **All server errors share one shape:** `{ success: false, error: { code, message, details? } }`. A central error handler produces it.

## Project structure

```text
.
├── client/
│   ├── src/
│   │   ├── components/      # VehicleSelectionForm, VehicleDropdown, QuickSelectButtons, LogbookUpload, SubmissionResult (+ tests)
│   │   ├── config/          # Quick-select presets
│   │   ├── hooks/           # useVehicleForm: all form state and transitions
│   │   ├── services/        # api.ts: every HTTP call (+ tests)
│   │   ├── types/           # API and vehicle types
│   │   ├── utils/           # Client-side logbook validation
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── vite.config.ts       # /api proxy and Vitest config
├── server/
│   ├── src/
│   │   ├── data/            # vehicles.ts: the single source of vehicle data
│   │   ├── middleware/      # Multer upload config, error and 404 handlers
│   │   ├── routes/          # /api/vehicles and /api/submissions
│   │   ├── services/        # vehicleService (lookups/validation), logbookService (text decoding)
│   │   ├── types/
│   │   ├── utils/           # AppError, request value parsing
│   │   ├── app.ts           # createApp(): Express app without listen (used by tests)
│   │   ├── config.ts        # Environment configuration
│   │   └── index.ts         # Starts the HTTP server
│   └── tests/               # Supertest API tests
├── sample-data/sample-logbook.txt
├── INTERVIEW_GUIDE.md
└── package.json             # Convenience scripts that run both packages
```

Separate `controllers/` were left out on purpose. Each route handler is a few lines that call a service, so another layer would only add indirection.

## Prerequisites

- **Node.js 22.12 or later** (tested on Node 24). This is the minimum version for Vite 8 and Vitest 5.
- npm 10 or later

## Installation

```bash
git clone <repo-url>
cd <repo>
npm run install:all          # installs server/ and client/ dependencies
```

Optional environment configuration (the defaults work as-is):

```bash
cp server/.env.example server/.env    # PORT, MAX_LOGBOOK_SIZE_BYTES
cp client/.env.example client/.env    # API_PROXY_TARGET
```

The server reads `process.env`, so in a shell you can also run `PORT=4000 npm run dev`. Node does not load `.env` files automatically. To use one, run `node --env-file=.env dist/index.js`.

## Running the backend

```bash
cd server
npm run dev      # http://localhost:3001, restarts on change (tsx watch)
# or, for production:
npm run build && npm start
```

## Running the frontend

In a second terminal:

```bash
cd client
npm run dev      # http://localhost:5173 (proxies /api to http://localhost:3001)
```

Open <http://localhost:5173>. To try it out, use `sample-data/sample-logbook.txt`.

For a production build: `npm run build && npm run preview` (http://localhost:4173, with the same `/api` proxy).

## Running tests and checks

From the repository root:

```bash
npm test             # server tests, then client tests
npm run typecheck    # tsc for both packages
npm run build        # production builds for both packages
```

Or inside either package: `npm test`, `npm run test:watch`, `npm run typecheck`, `npm run build`.

## API reference

Every response is JSON.

- **Success:** `{ "success": true, "data": ..., "message"?: string }`
- **Error:** `{ "success": false, "error": { "code": string, "message": string, "details"?: object } }`

### `GET /api/vehicles/makes`

Returns `200` with `data: [{ value: "ford", label: "Ford" }, ...]`.

### `GET /api/vehicles/models?make=ford`

| Status | When |
| --- | --- |
| 200 | `data: ["Ranger", "Falcon", "Falcon Ute"]` |
| 400 `VALIDATION_ERROR` | `make` missing |
| 404 `MAKE_NOT_FOUND` | Unknown make |

Make ids are matched exactly, in lowercase, as they appear in the data.

### `GET /api/vehicles/badges?make=ford&model=Ranger`

| Status | When |
| --- | --- |
| 200 | `data: ["Raptor", "Raptor X", "Wildtrak"]` |
| 400 `VALIDATION_ERROR` | `make` or `model` missing |
| 404 `MAKE_NOT_FOUND` / `MODEL_NOT_FOUND` | Unknown make, or the model isn't one of that make's models |

### `POST /api/submissions`

The request is `multipart/form-data` with the fields `make`, `model`, `badge` and `logbook` (the file).

| Status | Code | When |
| --- | --- | --- |
| 201 | – | Accepted. Returns the vehicle, the file name and the full logbook text |
| 400 | `VALIDATION_ERROR` | `make`/`model`/`badge` missing or blank (`details` lists each missing field) |
| 400 | `INVALID_MAKE` / `INVALID_MODEL` / `INVALID_BADGE` | The combination is not in the catalogue |
| 400 | `MISSING_FILE` | No file uploaded |
| 400 | `EMPTY_FILE` | The file has zero bytes |
| 400 | `UNEXPECTED_FILE` | A file sent under a field other than `logbook`, or more than one file |
| 413 | `FILE_TOO_LARGE` | Larger than `MAX_LOGBOOK_SIZE_BYTES` (default 1 MB) |
| 415 | `INVALID_FILE_TYPE` | The extension isn't `.txt`, or the MIME type isn't `text/plain` |
| 415 | `INVALID_FILE_CONTENT` | Contains NUL bytes (binary) or isn't valid UTF-8 |

`GET /api/health` returns `{ success: true, data: { status: "ok" } }`.

## Example request and response

```bash
curl -X POST http://localhost:3001/api/submissions \
  -F make=ford -F model=Ranger -F badge=Raptor \
  -F "logbook=@sample-data/sample-logbook.txt;type=text/plain"
```

```json
{
  "success": true,
  "message": "Upload successful - there is no spoon",
  "data": {
    "make": "ford",
    "model": "Ranger",
    "badge": "Raptor",
    "logbookFileName": "sample-logbook.txt",
    "logbookContents": "SERVICE LOGBOOK\nVehicle: Ford Ranger Raptor\n..."
  }
}
```

Error example (badge from the wrong model):

```json
{
  "success": false,
  "error": { "code": "INVALID_BADGE", "message": "Badge \"XR8\" does not belong to model \"Ranger\"." }
}
```

## Implementation decisions and trade-offs

| Decision | Why | Trade-off / alternative |
| --- | --- | --- |
| The vehicle data is served by the API instead of being bundled into the client | The client and the server's validation can't drift apart, and the catalogue can change without a client release | Each dropdown level costs one small request. The alternative is a single `/api/vehicles` call that returns the whole tree, which would be fine at this size |
| Dependent fields are reset in event handlers, not in `useEffect` | Each user action updates state once and atomically, and the UI never shows an invalid combination | A `useReducer` would collect the transitions in one function. That's worth doing if the form grows |
| A selection version counter guards async responses | A slow response for an old selection is ignored, so it can't overwrite newer options | `AbortController` would also cancel the HTTP request. The version check is still needed to handle results that are already in flight |
| Quick-select presets are checked against the API before being applied | Presets live in client config, so this stops them going stale | Presets could be served by the API instead |
| Multer memory storage with a 1 MB limit | Nothing is persisted, and the limit bounds memory use per request | For large files or real storage, stream to object storage instead |
| Server checks the extension, MIME type and content | The extension and MIME type are client-supplied and can be faked. The NUL-byte and strict UTF-8 checks look at the actual bytes | Libraries like `file-type` detect binaries by their magic numbers, but they can't positively identify plain text |
| `201 Created` on submit | The submission is a new resource from the API's point of view | `200` would also be reasonable, since nothing is persisted |
| Same-origin `/api` through Vite's proxy | No CORS configuration is needed, which matches a typical deployment behind a reverse proxy | A cross-origin deployment would need CORS middleware with an allow-listed origin |
| No controllers layer, no global state library | The app is small, and every layer should earn its place | Add them when the app grows |

### Assessment-specific requirements

- The Ford Falcon Ute's final badge is `XR6 🍌` (U+1F34C), in `server/src/data/vehicles.ts`.
- The success message is `Upload successful - there is no spoon`, in `server/src/routes/submissionRoutes.ts`. The page displays it after a successful upload.

### Known limitations

- The 1 MB limit is defined on both sides (`MAX_LOGBOOK_SIZE_BYTES`). The server is authoritative. If you change one, change the other. Exposing the limit through a config endpoint would remove the duplication.
- Logbooks must be UTF-8. Files saved as UTF-16 or Latin-1 are rejected with a clear message rather than being guessed at.
- There's no retry button if the makes fail to load. Refreshing the page retries.
- There's no rate limiting, authentication or persistence, because they're out of scope for this exercise.
