# Interview Guide: Vehicle Selection Form

A walkthrough of how the application works and why it is built this way. Each section names the files to open while you talk.

---

## 1. Overall architecture

**What:** two packages in one repo.

- `server/`: Express 5 + TypeScript. It owns the vehicle data and all validation.
- `client/`: React 19 + Vite + TypeScript. It renders the form, manages its state and calls the API.

```mermaid
sequenceDiagram
    actor U as User
    participant R as React (useVehicleForm)
    participant A as services/api.ts
    participant V as Vite proxy
    participant E as Express
    participant M as Multer (memory)
    participant S as Services

    U->>R: open page
    R->>A: fetchMakes()
    A->>V: GET /api/vehicles/makes
    V->>E: forward
    E->>S: vehicleService.getMakes()
    E-->>R: { success, data: [...] }

    U->>R: select make "ford"
    R->>R: clear model, badge, file, result; version++
    R->>A: fetchModels("ford")
    A->>E: GET /api/vehicles/models?make=ford
    E-->>R: ["Ranger","Falcon","Falcon Ute"] (ignored if version changed)

    U->>R: select model, badge, choose .txt file
    R->>R: validateLogbookFile() (UX only)

    U->>R: Submit
    R->>A: submitVehicle({make, model, badge, logbook})
    A->>E: POST /api/submissions (multipart/form-data)
    E->>M: parse; size/ext/MIME check
    M-->>E: req.body + req.file.buffer
    E->>S: readSelection → assertValidSelection → decodeLogbook
    E-->>R: 201 { message: "...there is no spoon", data }
    R-->>U: success, vehicle details, <pre> logbook text
```

**Why:** each part has one job. The data and its validation sit together on the server. The UI state sits in one hook. Network details sit in one module.
**Alternative:** Next.js with API routes in a single app.
**Why this fits:** the brief asks for React plus Express or Koa. Two small packages also make the frontend/backend boundary easy to see and explain.

---

## 2. How React talks to Express

**What:** components never call `fetch`. They call typed functions in `client/src/services/api.ts` (`fetchMakes`, `fetchModels`, `fetchBadges`, `submitVehicle`). A private `request<T>()` helper:

1. Catches network failures and throws `ApiError(..., status 0, 'NETWORK_ERROR')`.
2. Parses JSON defensively, because a proxy can return an HTML 502 page.
3. Converts the server's error envelope into an `ApiError` with `status`, `code` and `message`.

In development the browser calls the relative path `/api/...`. `vite.config.ts` proxies that to `http://localhost:3001`.

**Why:** there's one place to change the base URL, headers or error handling. Components only deal with data or an `ApiError`.
**Alternative:** axios, or TanStack Query, which adds caching, retries and deduplication.
**Why this fits:** fetch is built in, and four calls don't justify a library. TanStack Query would be my first addition if the app grew.

**Why a proxy rather than CORS:** the page and the API share an origin, so the server needs no CORS configuration. That's also how most production deployments look, with a reverse proxy routing `/api`.

---

## 3. Why the vehicle data lives on the backend

**What:** `server/src/data/vehicles.ts` is the only copy of the catalogue. The client gets it from three GET endpoints.

**Why:**

- The server must validate submissions against the catalogue anyway. A copy in the client could drift out of date.
- Changing the catalogue needs no client deploy.
- In a real system this data would come from a database or a vehicle-data service, and the API shape wouldn't change.

**Alternative:** a single `GET /api/vehicles` that returns the whole tree, filtered in the client.
**Why this fits:** both are fine at this size. Per-level endpoints match the brief and scale to large catalogues, where shipping the whole tree would be wasteful.

The one client-side vehicle list is the quick-select presets (section 6), and each preset is checked against the API before it is applied.

---

## 4. How dependent dropdowns work

**What (`client/src/hooks/useVehicleForm.ts`):**

| Action | State changes |
| --- | --- |
| `selectMake(make)` | selection becomes `{ make, model: '', badge: '' }`; models and badges cleared; file, result and errors cleared; fetch models |
| `selectModel(model)` | selection becomes `{ make, model, badge: '' }`; badges cleared; file, result and errors cleared; fetch badges |
| `selectBadge(badge)` | selection becomes `{ ..., badge }`; file, result and errors cleared |

The shared reset logic lives in `startSelectionChange()`, which every handler calls, including quick-select.

In `VehicleSelectionForm.tsx`, Model is disabled until a make is chosen, Badge until a model is chosen, and the file input until a badge is chosen.

**Why:** the reset happens in the same event handler that changes the parent. React batches these updates into a single render, so the UI never shows a model that doesn't belong to the make.
**Alternative:** a `useEffect` on `[make]` that clears the model and fetches models.
**Why not:** an effect runs *after* a render, so there's one frame with stale data. Effect chains are also harder to follow, and with quick-select an effect that clears the model when the make changes would wipe the values the preset just set. React's docs recommend handling user actions in event handlers.

---

## 5. How React state is managed

**What:** a custom hook, `useVehicleForm`, built from `useState` and `useRef`, returns state plus action functions. The components (`VehicleDropdown`, `QuickSelectButtons`, `LogbookUpload`, `SubmissionResult`) are presentational: props in, callbacks out.

The state is split into:

- **Selection**: `{ make, model, badge }`, held as one object so a reset is a single update.
- **Options**: `makes`, `models`, `badges`.
- **Status**: `loading.{makes,models,badges}`, `isSubmitting`.
- **Messages**: `optionsError`, `logbookError`, `submitError`, `result`.
- **Derived values**: `canSubmit` is computed during render and never stored, so it can't go out of sync.

**Alternatives:** `useReducer`, which puts every transition in one pure function, or Redux/Zustand.
**Why this fits:** the state is local to one form and the transitions are simple. A hook keeps the form logic testable and the components thin. If the form gained more steps, I'd move to `useReducer` first, because the handlers already map one-to-one onto actions.

There is exactly one `useEffect`, which loads the makes on mount. It has an `ignore` flag, so React StrictMode's double-mount in development and an unmount mid-request can't set state late.

---

## 6. How quick-select works

**What:** `config/quickSelect.ts` lists the presets. Clicking one calls `quickSelect(vehicle)`:

1. `startSelectionChange(EMPTY_SELECTION)` runs the same reset as manual selection.
2. It fetches models and badges in parallel with the same API functions.
3. It applies the preset only if the server returned it as valid (`badgeOptions.includes(badge)`; an unknown make or model has already failed with 404).
4. It sets the options and the selection together, so all three dropdowns fill in one render.

**Why:** the brief requires quick-select to go through the same state and validation path as manual selection, and here it does. A stale preset can't produce an invalid form; it shows an error instead.
**Alternative:** set the three values directly with no fetches.
**Why not:** the dropdowns would have no options to show, and nothing would confirm the preset is still valid.

The button for the current selection gets `aria-pressed="true"`, which gives visual and screen-reader feedback.

---

## 7. How multipart file uploads work

**What:** `submitVehicle` builds a `FormData` with `make`, `model`, `badge` and `logbook`, then POSTs it.

- The `Content-Type` header is **not** set by hand. The browser sets `multipart/form-data; boundary=...`, and setting it yourself drops the boundary, which breaks parsing.
- The text fields are appended **before** the file. Multipart is a stream, so this order means the fields are already parsed when the file part arrives.

**Why multipart:** it's the standard way to send binary or file data alongside fields, without base64's roughly 33% size overhead.
**Alternative:** read the file in the browser with `FileReader` and send JSON `{ make, ..., contents }`.
**Why not:** the brief says "upload", and multipart lets the server enforce limits before reading the whole body into a string. It's also how a real upload endpoint would work.

---

## 8. How Multer processes the file

**What (`server/src/middleware/logbookUpload.ts`):**

```ts
multer({
  storage: multer.memoryStorage(),          // req.file.buffer; nothing written to disk
  limits: { fileSize, files: 1, fields: 10, fieldSize: 1024 },
  fileFilter,                               // .txt extension AND text/plain MIME
}).single('logbook');
```

- Multer streams the request through busboy. Text fields go into `req.body` and the file into `req.file`.
- `limits.fileSize` stops reading once the limit is exceeded and raises `MulterError('LIMIT_FILE_SIZE')`. The error handler maps that to **413**.
- A file under any other field name raises `LIMIT_UNEXPECTED_FILE`, which becomes **400**.
- A rejection from `fileFilter` (an `AppError`) becomes **415**.

**Why memory storage:** the contents are read once and returned. Nothing persists, so there are no temp files to clean up and nothing sensitive is left on disk.
**Alternative:** `diskStorage`, or streaming straight to S3.
**Why this fits:** with a 1 MB cap, buffering is cheap and bounded. For large files or real storage I would stream to object storage instead.

**After Multer**, the route handler (`routes/submissionRoutes.ts`) runs these checks in order:

1. `readSelection(req.body)`: all three fields must be present. Every missing field is reported at once in `details`.
2. `vehicleService.assertValidSelection`: the make exists, the model belongs to the make and the badge belongs to the model.
3. `req.file` must be present.
4. `decodeLogbook(buffer)` (`services/logbookService.ts`): the file can't be empty or contain NUL bytes, and `TextDecoder('utf-8', { fatal: true })` must decode it.

---

## 9. Why validation runs on both frontend and backend

| | Frontend (`utils/logbookValidation.ts`, disabled controls) | Backend |
| --- | --- | --- |
| Purpose | Fast feedback and a better UX | Security and correctness (the authority) |
| Can be bypassed? | Yes (DevTools, curl, a modified client) | No |
| Checks | `.txt` extension, the type is `text/plain` or empty, not empty, ≤ 1 MB, all fields selected | Everything the frontend checks, plus that the vehicle combination exists, the MIME type, NUL bytes and UTF-8 validity |

**Why:** the client can't be trusted. Anyone can `curl` the endpoint. Client checks exist so users don't wait for a round trip just to learn that a PDF isn't allowed.

**Detail:** the client accepts an empty `file.type`, because some OSes report `.txt` files with no MIME type. The server is strict.

---

## 10. How API errors are handled

**Server:**

- Expected failures throw `AppError(status, code, message, details?)`.
- Express 5 forwards both sync throws and rejected promises from handlers to the error middleware, so there's no `try/catch` or `asyncHandler` wrapper in the routes.
- `middleware/errorHandler.ts`:
  - maps `MulterError` and `AppError` to the standard envelope;
  - turns other 4xx errors raised by Express or body parsing into a generic 400;
  - logs anything else and returns a generic **500** without leaking internal details.
- `notFoundHandler` returns a JSON 404 for unknown routes.

**Client:**

- `request()` turns every failure into an `ApiError`.
- The hook shows `error.message` inline in a `role="alert"` paragraph. There are three slots: option-loading errors, file validation errors and submission errors.
- After a failed submit, the form stays filled so the user can retry.

**Why error codes as well as messages:** the codes are stable and machine-readable, so the client can branch on them (`FILE_TOO_LARGE`, `INVALID_BADGE`). The messages are written for people and can change.

---

## 11. Preventing stale selections and race conditions

**Problem:** the user picks Ford, then Tesla, quickly. If the Ford models request is slow and resolves last, a naive implementation would show Ford models under Tesla.

**What:** `selectionVersion` is a `useRef` counter.

```ts
const version = startSelectionChange(...);   // increments selectionVersion.current
const options = await fetchModels(make);
if (isCurrent(version)) setModels(options);  // dropped if the user has moved on
```

The same check guards errors and loading flags, so a stale failure can't show an error for a selection the user has left.

**Other protections:**

- **Duplicate submissions:** `submittingRef` (a ref, so it updates synchronously and blocks a double-click before React re-renders), plus a disabled submit button.
- **Changes during a submission:** `<fieldset disabled={isSubmitting}>` locks every control, so the selection can't change mid-flight.
- **Stale results:** any selection or file change clears `result` and `submitError`.
- **The native file input:** its value can't be controlled from React, so `LogbookUpload` gets `key={make|model|badge}`. React remounts it whenever the vehicle changes, which clears the browser's chosen file. A rejected file is cleared with `event.target.value = ''`.

**Alternative:** an `AbortController` per request.
**Trade-off:** aborting also saves bandwidth, but the client still has to ignore results that resolve just before the abort lands. The version check is the guarantee, and abort would be an optimisation on top. TanStack Query handles both through query keys.

---

## 12. Security considerations

| Risk | Mitigation |
| --- | --- |
| XSS through logbook contents | Rendered as a React text node in a `<pre>`, so React escapes it. No `dangerouslySetInnerHTML`. The test includes `<b>` to prove it isn't interpreted, and the sample logbook contains a `<script>` tag |
| Large uploads (memory DoS) | Multer `fileSize`, `files: 1`, `fields: 10`, `fieldSize: 1 KB` |
| Spoofed file types | Extension **and** MIME type checked, then the content: NUL bytes and strict UTF-8 |
| Prototype-key lookups (`make=constructor`) | `Object.hasOwn` for every catalogue lookup, with a test that covers it |
| Query and field type confusion (`?make[]=a`) | `readString()` accepts only single string values, trimmed |
| Information leakage | Unknown errors return a generic 500. `x-powered-by` is disabled |
| Path traversal through file names | The file is never written to disk. The name is only echoed back as JSON and rendered as text |

**Not done (out of scope, worth mentioning):** helmet security headers, rate limiting, authentication, CSRF (there are no cookies or sessions, so it isn't applicable today), and malware scanning for uploads in a real system.

---

## 13. Testing strategy

**Server (`server/tests`, Vitest + Supertest, 28 tests):** HTTP-level tests against `createApp()`, so each one exercises routing, Multer, validation and the error handler together.

- Makes, models and badges: valid lookups, unknown make, a model that doesn't belong to the make, missing params, and the `constructor` lookup.
- Submissions: success (including the banana badge, UTF-8 content and BOM stripping), missing fields with `details`, invalid make, model and badge, missing file, wrong extension, wrong MIME type, binary content, invalid UTF-8, an empty file, a file over the limit (413), a file exactly at the limit (201), and an unexpected field name.
- `createApp({ maxLogbookSizeBytes: 1024 })` lets the size test use a 1 KB limit instead of uploading megabytes.

**Client (Vitest + React Testing Library + user-event, 21 tests):**

- `services/api.test.ts`: query encoding, error-envelope mapping, non-JSON errors, network failure, and the multipart body.
- `components/VehicleSelectionForm.test.tsx` renders the real `<App />` with the API module mocked, and tests what the user sees:
  - the initial disabled state
  - dependency loading
  - resets when the make, model or badge changes, including clearing the file
  - quick-select, on its own and replacing an existing selection
  - the slow-response race
  - an invalid file type and an oversized file
  - replacing a file
  - a successful submit with plain-text rendering
  - duplicate-submit prevention
  - a previous result clearing
  - API errors and makes failing to load

**Why mock at the API module:** components are tested against the API contract, not against `fetch` details, and the API module has tests of its own. Queries use accessible roles and labels (`getByLabelText('Make')`), so the tests also check accessibility.

**Not covered:** browser end-to-end tests. I'd add a short Playwright suite covering the happy path and one error path against the real server. During development I smoke-tested the real server and the Vite proxy with `curl`.

---

## 14. Production improvements

1. **Data source:** move the catalogue to a database or a vehicle-data service and cache the lookups.
2. **Config endpoint:** serve the upload size limit from the server so the client doesn't duplicate it.
3. **Data fetching:** TanStack Query for caching, retries and request cancellation.
4. **Hardening:** `helmet`, rate limiting on uploads, request ids, structured logging (pino), and graceful shutdown.
5. **Shared types:** put the API types in a shared workspace package, or generate them from an OpenAPI spec, so the client and server can't drift.
6. **Observability:** error tracking (Sentry), plus metrics on upload sizes and failure codes.
7. **CI:** run typecheck, tests, build and `npm audit` on every PR, and add a Playwright e2e suite.
8. **Deployment:** serve the built client from a CDN, run the API behind a reverse proxy on the same origin, and add a health check (`/api/health` already exists).
9. **UX:** a retry button for failed option loads, drag-and-drop upload, and a preview of the file before submitting.
10. **Storage:** if logbooks need to be kept, stream uploads to object storage with virus scanning and store metadata in a database.

---

## 15. Likely interview questions and sample answers

**1. Walk me through what happens when I change the Make after selecting a badge.**
`selectMake` calls `startSelectionChange({ make, model: '', badge: '' })`. That increments the selection version and clears the file, the result and any errors. It then empties the model and badge options, sets `loading.models`, and calls `fetchModels`. React batches those updates into one render, so the old model and badge never appear under the new make. When the response arrives, it's applied only if the version still matches.

**2. Why didn't you use `useEffect` to reset the dependent dropdowns?**
The reset is caused by a user action, so it belongs in that action's handler. An effect runs after a render, which means one render with an invalid combination, and chained effects are hard to follow. With quick-select, an effect that clears the model when the make changes would also wipe the preset's model. The only effect in the hook loads the makes on mount, which really is synchronising with an external system.

**3. How do you handle a slow response arriving after the user has moved on?**
A version counter in a ref. Each selection change increments it and captures the new value. After the `await`, results, errors and loading-flag updates are applied only if that captured value is still current. A test covers this: it resolves the Ford request after Tesla's and asserts the Tesla models remain.

**4. Why a ref for the version and for `submittingRef`, not state?**
They don't affect what's rendered, and they must update synchronously. A state update wouldn't be visible to the second click of a double-click until the next render. A ref changes immediately.

**5. How does quick-select reuse the manual-selection logic?**
It calls the same `startSelectionChange` reset and the same `fetchModels`/`fetchBadges` functions, and the same version check guards it. It then confirms the badge is in the server's list before applying it. If the preset is stale, the user sees an error rather than an invalid form. On submit, the server validates it again, exactly as for a manual selection.

**6. Where is the banana emoji, and how do you know it works end to end?**
It's in `server/src/data/vehicles.ts`, written as `'XR6 \u{1F34C}'` so the code point is unambiguous. A server test checks it's the last Falcon Ute badge, and another submits it successfully. The value travels as UTF-8 in the query string and the multipart field, and `Array.includes` compares the exact string.

**7. Why check the file's content when you already check the MIME type?**
The extension and MIME type both come from the client. `curl -F "file=@virus.exe;type=text/plain;filename=a.txt"` defeats them. The content checks look at the bytes: real text never contains NUL, and strict UTF-8 decoding rejects random binary data. It isn't perfect, since a binary could happen to be valid UTF-8, but it's a sensible check for "is this plain text", and the content is only ever displayed as text anyway.

**8. Why 413 for a large file and 415 for the wrong type?**
413 Payload Too Large and 415 Unsupported Media Type describe those failures exactly. Clients and monitoring can tell them apart from a generic 400, which I keep for malformed or missing input such as missing fields or an invalid vehicle combination.

**9. What happens if someone uploads a 2 GB file?**
Multer stops buffering once the stream passes 1 MB, raises `LIMIT_FILE_SIZE`, and the handler returns 413. Memory per request is bounded by the limit, not by the upload size. In production I'd also cap the body size at the reverse proxy so the bytes never reach Node, and add rate limiting.

**10. Why is the vehicle validated on the server when the dropdowns only offer valid options?**
The dropdowns constrain the UI, not the API. Anyone can POST `badge=XR8` with `model=Ranger`. `assertValidSelection` checks that the make exists, that the model belongs to it and that the badge belongs to the model, and it uses `Object.hasOwn` so a value like `constructor` can't match inherited properties.

**11. How do you prevent the uploaded logbook from causing XSS?**
It's rendered as `{data.logbookContents}` inside a `<pre>`. React inserts that as a text node and escapes it, so `<script>` shows up as literal text. There is no `dangerouslySetInnerHTML` anywhere, and a test asserts a `<b>` tag in the contents does not become an element.

**12. How would you deploy this?**
Build the client to static files on a CDN or nginx. Run the API as a Node process or container behind the same reverse proxy, routing `/api` to it, which keeps everything same-origin with no CORS. Configuration comes through `PORT` and `MAX_LOGBOOK_SIZE_BYTES`, and `/api/health` serves the load balancer's health check.

**13. Why Express 5?**
It's the current stable major. The relevant feature here is that it forwards rejected promises from async handlers to the error middleware, so there's no `asyncHandler` wrapper or `try/catch` in every route. Koa would also have worked; I picked the more familiar ecosystem.

**14. What would you change if the catalogue had 50,000 badges?**
Move it to a database with indexes on make and model. The per-level endpoints already avoid shipping the whole tree. I'd add HTTP caching (`Cache-Control`/`ETag`) since the catalogue rarely changes, and possibly a searchable combobox in place of a native `<select>`. Validation would become a single indexed lookup.

**15. What would you test next, and what's missing?**
A Playwright end-to-end test against the real server: the happy path plus one error. A test of the makes-retry flow once there's a retry button. Contract tests or shared types so client/server drift fails CI. On the server, a test that the 500 path doesn't leak error details.

---

## Quick file map for the walkthrough

| Topic | File |
| --- | --- |
| Vehicle data + banana | `server/src/data/vehicles.ts` |
| Lookups and validation | `server/src/services/vehicleService.ts` |
| Text decoding | `server/src/services/logbookService.ts` |
| Multer config | `server/src/middleware/logbookUpload.ts` |
| Error handling | `server/src/middleware/errorHandler.ts` |
| Submission route + "there is no spoon" | `server/src/routes/submissionRoutes.ts` |
| Form state and race handling | `client/src/hooks/useVehicleForm.ts` |
| Form layout | `client/src/components/VehicleSelectionForm.tsx` |
| API client | `client/src/services/api.ts` |
