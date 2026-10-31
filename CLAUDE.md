# CLAUDE.md

Claude Code instructions for the **Types** package.

## Package Identity

**@shipstatic/types** is the single source of truth for every shared
TypeScript type, constant and utility across the ShipStatic platform. A type
used by more than one package belongs here, with one carved-out exception:
"Admin types" under "Adding New Types". Read it before adding anything named
`Admin*`.

**Maturity:** stable; semver applies, so a breaking change needs a major
version bump (see the pre-launch exception under "Adding New Types").

**Releasing:** bump `version` in `package.json` and push. `ci.yml` publishes a
version not yet on the registry: a prerelease (any `-` suffix) to `beta` (from
either branch, normally `development`), a stable one to `latest` from `main`. Nothing is published by
hand.

## Architecture

Two files. `src/index.ts` holds the types, in named sections in the order
below; `src/schemas.ts` holds the wire schemas and is published as the subpath
`@shipstatic/types/schemas`, so a consumer that never imports it carries no zod.

**The root entry is ONE declaration file, and consumers rely on it.**
`@shipstatic/ship` inlines this package's declarations (`dts.resolve` in its
`tsup.config.ts`), and the bundler inlines the entry alone: a sibling module
re-exported from `index.ts` is left behind as a relative import that resolves
to nothing in ship's `dist`, which `attw` refuses. So a new root export is a
section of `index.ts`; only a subpath entry (`schemas`) is its own file.

| Section | Purpose |
|---------|---------|
| Core Entities | `Deployment`, `Domain`, `Token`, `Account`: status consts, interfaces, list responses, request shapes, DNS and aggregate responses, mutation acknowledgements (notes below) |
| Wire Surface | `API_PATHS` (every public path, declared once; the operator routes deliberately absent, see "Admin types"), `DEPLOY_FIELDS` (the multipart field names), `DEPLOY_FILE_GRAMMAR` (+ `DeployFileSpec`, `DeployFileEncoding`, the JSON body's file grammar): the halves of one wire surface |
| Error System | `ErrorType`, `ShipError`, `isShipError`, `BuildFailureDetails` (the evidence a human surface renders beneath a build verdict) |
| Platform Limits | `PlatformLimits`, from `GET /limits`: the three plan caps, the optional `blockedExtensions` and `suggestions` (keyed by `PlatformLimitKey`). An absent optional field means an older API, never an empty policy: no client-side check, and nothing to append |
| Extension Matching | `isBlockedExtension(filename, blocked)`: the matching RULE only; the LIST is the API's and arrives as data ("The worked split") |
| Picker Accept Hint | `WEB_FILE_ACCEPT`: a file picker's `accept`, a **hint, never a rule** (an allowlist, where the platform's rule is a blocklist). The API's suite holds the invariant that the picker never offers what the platform refuses |
| Filename Character Validation | `UNSAFE_FILENAME_CHARS`, `hasUnsafeChars()` |
| Unbuilt Project Markers | `UNBUILT_PROJECT_MARKERS`, `hasUnbuiltMarker()` |
| Deploy Rules | `FILE_RULES`, `SET_RULES`, `firstBrokenRule`, `brokenSetRule`, `deployRefusal`, `isPublishedFile`, `DeployEntry`, `canonicalDeployPath`, `namedTwice`, `DEPLOYMENT_INDEX_FILENAME`, and the predicates they read, `validateFileName` and `isDeployablePath` (+ `MAX_PATH_BYTES`). See "Deploy rules" |
| Common Responses | `PingResponse` (`timestamp` in unix seconds) |
| Credential Shapes | `AUTH_BASE_PATH`, `AuthMethod`, `API_KEY` / `DEPLOY_TOKEN` / `OAUTH_TOKEN` / `CALLER`, both halves of the Bearer slot (`readBearerValue` reads it, `TokenKind` + `classifyToken` dispatch on it), `OAuthScope` |
| Deployment Config Constants | `DEPLOYMENT_CONFIG_FILENAME`, `assertShipJsonSyntax` (syntax only, never schema) |
| Validation Utilities | `validateIdempotencyKey` (+ `IDEMPOTENCY_KEY_CONSTRAINTS`, which owns the header name too), `normalizeVia`, `validateToken`, `validateApiKey`, `validateDeployToken`, `validateOAuthToken`, `validateCaller`, `validateApiUrl`, `isDeployment`, `validateTtl` (+ `TTL_CONSTRAINTS`) |
| SPA Check Types | `SPACheckRequest`, `SPACheckResponse` |
| Static File | `StaticFile` (cross-environment file representation) |
| Person Name | `personName`, `personShortName`: what a person is ADDRESSED by (name, else address; the first word where room is narrow). A surface that STATES a name as a fact does not call them |
| Time Remaining / File Size | `formatTimeRemaining`, `formatDuration` / `formatFileSize` (see their sections) |
| Console Paths | `consolePaths`, `SECTIONS`, `doors`, the matchers, `billingReturnOf` (see "Console paths") |
| Platform Constants | `DEFAULT_API`, `PUBLIC_DEPLOYMENT_TTL_SECONDS`, `BUILD_TIME_LIMIT_SECONDS`, `SHIP_ENV`, `SHIP_VIA_ENV`, `MY_API_KEY_URL` (notes below) |
| Resource Contracts | `DeployInput`, `DeploymentUploadOptions`, `*Resource` interfaces |
| Billing Types | `BillingInterval`, `Plan`, `PlansResponse`, `BillingPortalSession`, `PlanChangeRefusalDetails`: vocabulary only, spelled as Stripe spells it (`tests/billing-vocabulary.test.ts`). No price or cap is published; `GET /plans` delivers them |
| Activity Types | `ActivityEvent`, `UserVisibleActivityEvent`, `Activity`, `ActivityMeta`, `ActivityListResponse`. Deliberately **no** `ActivityResource`: the SDK does not reach `GET /activities`, and an interface nothing implements is dead surface |
| File Upload Types | `FileValidationStatus`, `ValidationIssue`, `ValidatableFile`, `FileValidationResult`, `UploadedFile` |
| Domain Utilities | `isPlatformDomain`, `isCustomDomain`, `extractSubdomain` (a platform domain is a domain under a serve domain, the domain sites are served under; a custom domain is any other), `addressOf`, `deploymentOf`, `isAddress` (a deployment's address: its id as the one first label under a serve domain; `isDeployment` alone accepts any dotted suffix, so it is not the address test), `generate*Url` |
| Label Utilities | `LABEL_CONSTRAINTS`, `LABEL_PATTERN`, `validateLabel`, `validateLabels`, `serializeLabels`, `deserializeLabels` |
| Password Utilities | `PASSWORD_CONSTRAINTS`, `validatePassword` |

Notes on the sections:

- **`DeploymentVia`** is the origin vocabulary, closed so the clients that name
  themselves are compiler-checked; `Deployment.via` stays `string | null`
  because stored rows predate it.
- **The account's counts.** `Caps` is the cap keys both `usage` and `caps`
  carry, so the pair divides. `AccountUsage` is `Caps` plus the pending
  `invitations`, which take member places and have no cap of their own;
  `placesTaken` is the two as one. `excessOver` is what an account holds
  beyond a set of caps (members, then invitations to cancel, then domain
  kinds; deployments gate nothing). `USAGE_KIND` is each count's noun, and
  `countPhrase` and `fitPhrase` make the API's refusals and the console's room
  notes one sentence-maker. `AccountRefusal` is the two words a refusal
  carries in `details.account`: `paused` and `unknown`.
- **Requests and responses**: `ListResponse`, `ListOptions`, the three
  `*SetOptions`/`TokenCreateOptions`, `DnsRecord`, `DnsProvider`, `DnsLookup`,
  `DomainDnsResponse`, `DomainRecordsResponse`, `DomainShareResponse` (+
  `SETUP_TROUBLESHOOTING_ANCHOR`, the one section of its page a link may name),
  `DomainValidateResponse`, `LabelsResponse`, `SetupInstructionsResponse`,
  `DomainSetResult`, and the acknowledgements (`DeploymentDeleteResponse`,
  where the law is written, then `DomainDeleteResponse`,
  `DomainVerifyResponse`, `TokenDeleteResponse`, `AccountDeleteResponse`,
  `AccountKeyResponse`).
- **The single-page routing config is the platform's to write**, so it lives
  with its one writer, the API. A deploy asks for it by sending
  `DEPLOY_FIELDS.SPA` (`spa`) as `true`, which every client does unless
  `DeploymentUploadOptions.spaDetect` is `false`; absence asks nothing. The
  option and the field are two names for two layers; neither is renamed.
- **`normalizeVia`** lives here because a client reaches the same verdict
  offline, which is this package's test for a format rule.
- **Platform constants.** `PUBLIC_DEPLOYMENT_TTL_SECONDS` is the anonymous
  deploy lifetime: the API stamps `expires` and the claim window from it, and
  both MCP transports derive the duration they quote. `BUILD_TIME_LIMIT_SECONDS`
  bounds a whole build; the API's wait and the SDK's build timeout import it,
  and fences hold the build service and the docs to it. `SHIP_ENV` is the Node
  SDK's ambient pair (`SHIP_TOKEN`, `SHIP_API_URL`), the complete scrub list
  for embedding hosts, CLI-only vars excluded. `SHIP_VIA_ENV` is the
  subprocess wrapper's origin relabel (the CLI and the stdio MCP bin read it),
  outside `SHIP_ENV` because the SDK never does. `MY_API_KEY_URL` is the
  console deep link every authentication-teaching surface quotes: the bare
  `consolePaths().apiKey()` on the production console. It is computed inside
  a function marked `/* @__PURE__ */`, so a bundle that never reads it (the
  platform's frozen router) drops it and `consolePaths` with it; a plain
  template keeps both. **A top-level constant computed by a call carries
  the same mark**, or every bundle of this package carries the call.
- **A label** is a word (`production`) or a key and value split by one `:`
  (`env:production`), stored lowercase and shown as stored. The platform reads
  nothing from a key or a value, so one key may carry several values.
  `validateLabels` is the one check: the SDK, the console and the API call it.

## Wire schemas (`src/schemas.ts`, `@shipstatic/types/schemas`)

**The interfaces own the types; the schemas restate them as data, fenced**, so
a tool can publish an `outputSchema` and a consumer can validate a response
without a hand-kept twin. Not schema-first, because `z.infer` cannot carry
per-field JSDoc into an editor and makes every field mutable or every field
readonly, where the entities mix the two. `tests/schemas.test.ts` holds each
pair at compile time (the same keys, the interface assignable to the schema's
output), so a key added to one side fails `pnpm typecheck`.

**A schema promises what the wire promises ACROSS versions**, so it is looser
than the type in one place. A vocabulary the platform grows (`status`, `plan`,
`via`) is a string whose description names today's members, derived from the
constant: a consumer validates with the schema it shipped with (the VS Code
extension bundles its server for months), and an enum would make the next word
a validation failure on every older client. A vocabulary not ours to grow (a
DNS record type, Stripe's billing interval) is an enum. The fence is
assignable, not equal.

**Every field is described, and that is fenced too** (a walk of the published
JSON Schema): the descriptions are what an agent reads. They shorten the
interfaces' JSDoc to what a reader of a result needs and move with it.

zod is a real dependency, at `^4.4.3` so every consumer resolves one copy.
`typesVersions` carries the subpath for the node10 resolver `check:package`
probes; the platform's engines floor never uses it.

## Quick Reference

```bash
pnpm build          # TypeScript compilation validates all types
pnpm test --run     # runtime tests
pnpm typecheck      # tsc -p tsconfig.check.json: src AND tests
pnpm check:package  # publint + attw over the built artifact
```

## Key Patterns

### ShipError

```typescript
// Every factory takes an optional `details?: unknown` last, except `notFound`,
// which composes its message from `(resource, id?)`. The multi-status
// fallbacks (`business`, `api`) take an optional status before details.
ShipError.validation(message, details?)
ShipError.notFound(resource, id?)
ShipError.forbidden(message, details?)
ShipError.authentication(message?, details?)  // see "internal: telemetry" below
ShipError.rateLimit(message?, details?)
ShipError.business(message, status?, details?)  // status defaults to 400
ShipError.network(message, details?)            // pass `{ cause }` for the underlying Error
ShipError.timeout(message, details?)            // a deadline expired; isNetworkError() is true
ShipError.cancelled(message, details?)
ShipError.file(message, details?)               // pass `{ filePath }` for the path
ShipError.config(message, details?)
ShipError.api(message, status?, details?)       // status defaults to 500
ShipError.maintenance(message, details?)        // status FIXED at 503; message required
ShipError.build(message, { log })               // status FIXED at 422 (BuildFailureDetails)

error.isClientError()      // a client-fault TYPE, or any 4xx STATUS
error.isNetworkError()
error.isAuthError()
error.isType(errorType)    // or `error.type === ErrorType.X`
error.toResponse()         // producer side: ErrorResponse JSON

await ShipError.fromHttpResponse(response, operationName?)  // server returned non-OK
ShipError.fromFetchError(cause, operationName?)              // fetch itself threw
isShipError(error)         // structural guard (survives module duplication in bundles)
```

**The five client-only factories (`network`, `timeout`, `cancelled`, `file`,
`config`) are exactly the statusless ones, and that pairing is load-bearing.**
`ErrorResponse.status` answers "what would the wire say?". A local pre-check
that MIRRORS a server rule (blocked extension, label shape, token format)
keeps the server's type and 400, so the error reads the same wherever it was
caught. A fault with no server rule to mirror (wrong runtime, unreadable file,
a CLI's own command grammar) has no status and takes one of these five. The
worked split is "What a status means" in the SDK repo's own instructions.

### `internal:` telemetry pattern (Authentication errors)

Server-side auth code tags `details` with WHICH check failed, without telling
the client:

```typescript
throw ShipError.authentication('Authentication failed', { internal: 'jwt_missing_subject' });
```

`toResponse()` strips the entire `details` object when `details.internal` is
truthy on an Authentication error, so the wire carries the flat
`{ error: 'authentication_failed', message: 'Authentication failed', status: 401 }`
while the server keeps the tag for logs and tests. Other `details` keys
round-trip normally. **Never put client-visible information under
`internal`.** `details` is `unknown` everywhere; narrow at the read site:
`(error.details as { internal?: string } | undefined)?.internal`.

### Error Flow

**The message authoring law.** The wire `message` is written for the person
who reads it, at the throw site, and every surface relays it. Machine data
(timestamps, ids) goes in `details`, which reaches machine channels and is not
rendered in human ones. Clients branch on `error` type or `status`, never on
message strings, which keeps message improvements free.

**A surface composes its own copy in exactly two cases**, both the absence of
a wire message:

- **Nothing was received** (network failure, timeout, cancellation).
- **Authentication.** Every cause arrives as the same flat "Authentication
  failed" on purpose, because naming the failed check tells an attacker which
  one to fix, and the remedy is client-specific (the CLI names its flags, the
  console says the session expired). This and the `internal:` pattern are
  one decision.

**Everything else is relayed, including 5xx.** The API's global handler emits
an authored sentence (a 503 naming what is unavailable) or a flat generic, and
sends the raw failure to its operator channel, never to the client. A surface
may ADD chrome (a toast title, a status-page pointer), never replace the
message.

One path in each direction; there is no other way to build or hydrate a
`ShipError` in HTTP context:

```
Producer (the API):  throw ShipError.validation('Email required')
                     → app.onError(err) → c.json(err.toResponse(), err.status ?? 500)
WIRE (JSON):         { error: 'validation_failed', message: 'Email required',
                       status: 400, details?: unknown }
Consumer (the SDK, the console):
  non-OK response →  throw await ShipError.fromHttpResponse(response, operationName)
                     // trusts body.error if server-producible, else by status
                     // (401 Authentication, 403 Forbidden, 429 RateLimit, else Api)
  fetch threw     →  throw ShipError.fromFetchError(cause, operationName)
                     // ShipError passes through • AbortError: Cancelled
                     // TimeoutError: Timeout • transport: Network • other: Api
```

**Conventions:**

- **The wire type round-trips**: a server `validation` arrives as
  `ErrorType.Validation`, and guards and comparisons both work.
- **Status drives type for a response with no API body** (a CDN, an
  intermediary): 401, 403, 429 as above, else `Api`.
- **Type and status are independent axes, and `isClientError()` reads
  both.** A CDN 404 arrives as `Api`, a server-fault type with a client status;
  a type-only guard would call it a platform failure. The type set still
  carries the statusless local faults (`Config`, `File`).
- **Client-only types stay client-only.** `Network`, `Timeout`, `Cancelled`,
  `File` and `Config` claimed in `body.error` are ignored
  (`CLIENT_ONLY_ERROR_TYPES`).
- **No HTTP error logic outside the two helpers**: no private wrappers, no
  duplicated parsing.
- **A non-JSON body is a foreign responder's, trusted only as far as it reads
  like a message.** A CDN's `error code: 1015` is worth showing; a proxy's
  HTML page is a document. It becomes `message` only when it does not open as
  markup and is at most `MAX_FOREIGN_MESSAGE_LENGTH` (200) characters; else
  the `operationName` fallback wins. **JSON bodies are never measured against
  it**: they are the API's contract, and truncating one would be the bug.

### Transport truth: the shape table, and which side of it is bounded

`fromFetchError` answers *did the exchange happen?*, and a guess is wrong in
the expensive direction: `Api` claims a server answered, and a caller who
retries on `Network` will not retry it. The per-runtime table lives in the
`isTransportFailure` JSDoc, its capture scripts in `tests/errors.test.ts`.

**The rule reads that table backwards, by design.** Transport failures are
unbounded (every OS, TLS and DNS failure any engine names); fetch's complaints
about its own ARGUMENTS are few, and every runtime names the URL in one. So
the bounded side is tested, and the residual points the safe way: an
unrecognised sentence lands on `Network`, which claims only that nothing was
exchanged. WebKit's `Load failed` is `Network`; a malformed URL is `Api` on
every engine.

**workerd is a recorded gap.** It rejects with a plain `Error`, no code and two
unrelated sentences, so nothing can classify it honestly and it lands on
`Api`. No dialect string, because the one in-Worker consumer is not a source of
transport rejections.

**Abort and timeout are read from `name` before the `instanceof Error`
gate.** A `DOMException` passes that gate in every runtime measured, so the
suite plants a non-`Error` shape to hold the arm.

- `AbortError` → `Cancelled`: someone stopped it on purpose.
- `TimeoutError` → **`Timeout`**, message `"<op> timed out"`, with
  `isNetworkError()` **true**: no server answered and nobody cancelled, so
  nothing was exchanged, which puts a timeout in the same retryable class as a
  refused connection.
- **The type is distinct and the category shared, which is the design.** A
  consumer that DECIDES on the category (retry, no incident, no wire message)
  treats both alike; one that RENDERS must not say "check your internet
  connection" about a deadline. Comparable SDKs do the same
  (`APIConnectionTimeoutError extends APIConnectionError`).
- `Timeout` is the one client-only type outside `isClientError()`: the caller
  set the ceiling but the network or server exhausted it, so calling it
  client-attributable would misname the fault and disarm every retry predicate
  that declines a client error.
- **WebKit reports a fired `AbortSignal.timeout()` as `AbortError`**, so on
  Safari a deadline lands on `Cancelled`. Recorded, not worked around: the
  caller's signal stopped it.

### Resource Contracts

Interfaces define the **minimal contract**; SDK implementations may add runtime
options (timeout, signal, callbacks). Always match the full interface:

```
DeploymentResource : upload, list, get, set, delete
DomainResource     : set, list, get, delete, verify, validate, dns, records, share
TokenResource      : create, list, get, delete
AccountResource    : get
```

`upload`'s wide input is `DeployInput` (`File[] | string | string[]`); each
SDK narrows its `Ship.deploy()` shortcut (`File[]` in the browser,
`string | string[]` in Node) and validates the resource-layer call at runtime.
No `BillingResource` or `KeysResource`: the console calls billing directly.

### A domain says one derived word, and three raw facts once each

`Domain` is the worked example of separating a STANDING from the facts it is
derived from; read it before adding a status-shaped field anywhere.

| Field | Kind | Values |
|---|---|---|
| `status` | the one DERIVED word: what this domain needs from its owner | `live`, `unlinked`, `unverified`, `paused` |
| `verification` | the DNS fact | `pending`, `partial`, `verified` |
| `verified` / `verifications` | when it LAST became verified (monotonic) / attempts | instant or null / count |
| `deployment` / `linked` / `links` | the link fact, the same trio shape | hostname or null / instant or null / count |
| `paused` | the plan fact | instant or null |

**`status` has ONE owner, and it is not in this package.** The platform derives
it beside the record that decides what a domain serves. The `DomainStatus`
docblock states the precedence as the PUBLISHED RECORD of that rule, never a
second implementation: a consumer reads the word. One that recomputes it from
`deployment` and `verification` becomes a copy that drifts.

**The instant decides NOTHING.** `verified` is monotonic, so a domain whose
records move away reads "not verified now, last was <date>": it answers a
history question, `verification` the present one. Reading it as a boolean
makes a drifted domain verified and unverified at once. Clearing it is
refused: a first verification has once-only consequences the stamp records.

**`status` is a repurposed wire name, and that is NOT precedent.** It carried
the DNS enum before 3.0.0. The API's compatibility rules forbid repurposing a
wire name; this was the one exception granted, because `status` is the right
name for a standing and a `standing` field beside a deprecated `status` would
have kept the half-design forever. It shipped as one breaking release.

**Field ORDER is contract here.** The CLI's `formatDetails` renders wire key
order, so `ship domains get` shows the fields as declared: identity, standing,
link trio, DNS trio, plan fact, housekeeping. Keep new fields in their group.

### Status Constants Pattern

`as const` object plus derived union, in two variants:

```typescript
// Standard: value object + `*Type` union
export const FooStatus = { PENDING: 'pending', ACTIVE: 'active' } as const;
export type FooStatusType = typeof FooStatus[keyof typeof FooStatus];

// Shared name, when the entity name already ends in "Type"
export const ErrorType = { Validation: 'validation_failed', ... } as const;
export type ErrorType = typeof ErrorType[keyof typeof ErrorType];
```

Standard: `DeploymentStatus`, `DomainStatus`, `DomainVerification`,
`AccountPlan`, `FileValidationStatus`, `AuthMethod`, `TokenKind`. Shared:
`ErrorType`.

**Readonly vs mutable:** `readonly` for stable fields (`id`, `created`,
`url`); mutable for fields the API updates (`status`, `expires`, `labels`,
`deployment`).

### Time remaining: one deadline, one reading

**`formatTimeRemaining(expires, now?)`** is the time left before a
deployment's `expires`, in words (`"3 days"`), or `null` once passed;
**`formatDuration(seconds)`** spells any span the same way. Every surface that
tells a deadline reads it here, so one deployment reads the same everywhere.

**The ladder**: minutes under two hours, hours under two days, days beyond,
each rounded to the nearest. The unit changes where the larger one rounds to
two, so the number never jumps, and "1 hour" and "1 day" (the vaguest things a
rounded clock says) never appear. Rounding lets a fresh deployment read the
lifetime it was given. `tests/time-remaining.test.ts` plants the boundaries
and holds two properties against an independent reading of the words: less
time left never reads as more, and neither vague phrase appears.

**Not owned here, on purpose:**

- **The sentence around the words**: each surface's register is its own, and
  so is what it says after the deadline, which is why that case is `null`.
- **A compact form** (`2d`, `5h`): refused. A dense table has room for
  "3 days", and two spellings under one owner are two readings of one deadline.
- **Locale**: English today; a locale parameter goes here when localisation
  lands (`Intl.RelativeTimeFormat` is the likely shape).

**Refused: a subpath of its own** (`@shipstatic/types/time`). **A subpath is
earned by a dependency boundary** (`/schemas` keeps zod out of bundles that do
not validate), never by bytes of this package's own code. If a consumer's size
budget binds, make the main entry's constants tree-shakeable, which serves
every helper at once; `sideEffects: false` alone changes nothing (same bytes).

### File size: one number, one reading

**`formatFileSize(bytes, decimals = 1)`** spells a byte count (`"180 KB"`,
`"2.5 MB"`), in binary units. `decimals` is the one choice a surface makes,
because density is presentation (the console's tables read at 0). Every
surface that states a deployment's size reads it here (the console through
ship's re-export, the CLI, the deploy card, the API's size refusals): a table
saying `180.0Kb` beside a card saying `180 KB` is drift nothing raises.

## Deploy rules (the "Deploy Rules" section)

**One table of rules, one sentence each, and every judge reads it.** The API
judges a deployment's declared files by it, the SDK judges its files by it
before the first request (both deploy pipelines throw the first broken rule;
`validateFiles` lists them), and drop shows the SDK's verdict. So a refusal
reads the same wherever it is made, and a rule cannot reach one judge without
the others. `tests/deploy-rules.test.ts` holds it.

- **`FILE_RULES`**, each file in order, the running total included, the first
  broken rule reported: a file that breaks two reports the first, because
  fixing it may fix the other.
- **`SET_RULES`**, the deployment as a whole, after every file: it has files,
  names each path once (an empty file included, since it still names the
  key), holds no more than the plan allows, and has a home page, `index.html`
  at its root, exactly (`DEPLOYMENT_INDEX_FILENAME`). ShipStatic publishes
  websites, and a website starts at its home page. No exception, a
  `ship.json` that redirects `/` included: a redirect-only site carries an
  `index.html` nobody sees.
- **The home-page refusal ends with the one step that fits the files**
  (`missingIndexAdvice`): the folder to publish when exactly one folder holds
  the shallowest nested `index.html`, the page to rename when there are pages
  but none at the top (a single `report.html`), and a small page to add when
  there is no page at all (an image or a PDF alone). The last is the
  commonest refused upload, so without it most people refused would have no
  next step.
- **Every sentence is complete on its own** and names its file once (the set
  rules name none), so every surface shows it as it is.
- **Paths compare in one form** (`canonicalDeployPath`: one leading slash
  names the same path), inside the rules, so a judge passing `/index.html`
  and one passing `index.html` agree, and the API's stores key by the same
  function. **It is idempotent, and that is load-bearing**: the API makes a
  path canonical at intake and the rules do it again, so a function that
  dropped a slash per call would let `//index.html` pass as the home page and
  be stored under a doubled slash, with no page at the root. Two leading
  slashes stay two, and the path rule refuses the empty segment. `namedTwice`
  is the sentence for a repeated path, which the API's intake also says.
- **A name is not refused for a `..` inside it.** `report..final.pdf` is a
  file name; a `..` SEGMENT starts with a dot, which the path rule already
  refuses in words that say what is wrong.
- **A limit's sentence ends with the way forward the API delivered**
  (`PlatformLimits.suggestions`), so the client never learns a plan name.
- **A judge passes the files as SENT, empty ones included, and the table
  decides what is published** (`isPublishedFile`): no deployment stores an
  empty file, so one is left out of the per-file rules and the totals, never
  refused, and every store reads the same predicate to drop it. The set rules
  still see it, so an empty `index.html` is refused as empty ("The index.html
  at the top of your site is empty.") rather than as missing.
- **A refusal is a sentence and a type, never a rule name.** Every deploy-rule
  refusal is `validation_failed` at 400, and no client reads which rule broke.
  Refused: a `details.rule` carrying the table's `name`, since nothing would
  read it and the sentence already names the fix. Reopen when a client must
  act on one rule by itself (an agent that wraps a lone file in an
  `index.html`); the field is then the table's `name`, already stable.

The rules are format, not policy, by this package's test: each is computed
from the files alone, and the API refuses the same files the same way. The
two policy inputs, the limits and the blocklist, arrive as data from `/limits`.

## Console paths (the "Console Paths" section)

**The console's path grammar has one owner, because it has two holders.** The
console mounts these paths as routes; the API, its emails and its billing
returns emit them as links. A drift is a link that 404s with nothing to report
it, and no fence reaches across the two codebases.
`tests/console-paths.test.ts` holds it.

- **`consolePaths(account?)`** returns the builders bound to one account
  (`/<account>/domains`), or with no account the bare form (`/domains`). A
  producer whose subject is an account composes that account's path; one
  whose subject is a person emits the bare form, which the console opens in
  the account the person entered last.
- **`SECTIONS`** lists an account's sections by first segment, with the
  `owner` flag on the four that mean the reader's OWN account (`upgrade`,
  `success`, `billing`, `api-key`): a bare path into one opens the person's
  own account. `billing` is the one way into the Stripe Customer Portal: the
  console mints the session there on arrival, so a link (a letter's
  included) can name it, where a Portal session URL is minted per request
  and expires.
  The console mounts every section twice from it. Modals carry their own owner
  rule in the console; the flag is the section's alone.
- **The claim is a section, not a door.** A claim link
  (`consolePaths().claim(code)`, `/claim/<code>`) is the bare form the API
  mails; the console opens it where it opens `/`, in the account the person is
  standing in. What a person does IN an account is a section, whoever composed
  the link.
- **`doors`** builds the pages a PERSON stands on before an account is known
  (`login`, `register`, `logout`, `invitation`, `consent`), one builder per
  door segment and named for it, which the compiler holds; the console mounts
  every door from its builder. A door's object rides its path and the journey
  rides the query: `invitation(id)` takes its object, the three sign-in doors
  take the journey by name (`login({ next })`, `register({ next })`,
  `logout({ next })`). The sign-in link's token is the login door's object, on
  its own page: `login.link({ token, next })` is `/login/link/<token>`, which
  the API writes into the sign-in email and the console mounts.
- **The matchers** (`doorOf`, `isClaimPath`, `isUpgradePath`, `errandOf`,
  `accountOfPath`) read a path in either form the way the console's router
  does: case-insensitively, ignoring a trailing slash, the query and the
  fragment. `billingReturnOf` reads the two query markers a Stripe return
  lands with, which the builders write (`successAfterCheckout`,
  `settingsAfterBilling`), so neither side spells a marker. `doorOf` is the
  one reader of the doors: an auth page, an errand and what a vendor must not
  see are each a question about which door a path names, so no per-door
  predicate exists.

**Sections, doors and the reserved operator segment are disjoint sets of
first segments**, held at compile time inside the module: a shared name fails
the build. So the grammar reads any other first segment as an account id
without checking its shape; whether the account exists is the server's
answer, never the path's.

The console-only sub-paths (the `qr`, `labels` and `delete` modals,
`settings/name` and the rest) stay in the console: no server emits them, so
they have one holder.

**Refused: moving `errandOf`, `accountOfPath`, `SECTIONS` or the other readers
out of this package.** The API reads them too, so they are the grammar's.

## Consumers

| Consumer | Uses |
|---------|------|
| `@shipstatic/ship` (SDK and CLI) | all types, `ShipError`, validation utilities, `formatTimeRemaining`, `formatFileSize` (re-exported) |
| `@shipstatic/drop` | `FileValidationStatus`, `ValidatableFile`, `PlatformLimits`, `hasUnbuiltMarker`, `WEB_FILE_ACCEPT` |
| `@shipstatic/mcp`, the VS Code extension | entity types, `formatTimeRemaining` / `formatDuration` (`PUBLIC_EXPIRY` spells the anonymous lifetime with `formatDuration`) |
| the API and the platform's other Workers | entity types, `ShipError`, constants, `formatFileSize`, the console path grammar |
| the console | entity and response types, `formatTimeRemaining`, `formatFileSize`, the console path grammar |
| the marketing site | `formatTimeRemaining` |

## The typecheck covers `tests/` too

`pnpm typecheck` runs `tsc -p tsconfig.check.json` over **`src` and
`tests`**; `tsconfig.json` stays build-shaped (`rootDir: src`, declaration
output) for `pnpm build`. Vitest transpiles through esbuild **without**
typechecking, and `tests/` carries compile-time assertions (the list-contract
fence in `validation-constants.test.ts`: every paginated `list` takes
`ListOptions`, every list response carries a `cursor`, none a `total`), which
outside the program would assert nothing.

**A fence written as a type assertion is only a fence if the typecheck sees
it.** After adding one, prove it fires: introduce the drift, watch the
typecheck fail, restore.

## `pnpm check:package` and the one rule it ignores

`publint && attw --pack . --ignore-rules cjs-resolves-to-esm`, the same gate
ship, drop, the two unscoped wrappers and `@shipstatic/mcp` run.

**The ignored rule is a decided property, not a suppression.** This package is
ESM-only (`"type": "module"`, one `exports` condition), so a CJS consumer gets
`attw`'s CJSResolvesToESM warning by construction. It is safe because no
published CJS artifact requires it at runtime (every first-party consumer
takes it as a devDependency and BUNDLES it, which is also why a constant
compiled in here ships stale until each consumer rebuilds), and the
platform's `engines.node >=20.19.0` floor is where `require(esm)` was
backported. Revisit the ignore first if a real CJS consumer appears.

## Adding New Types

1. Find the right section in `src/index.ts` (keep the section order above).
2. Add JSDoc to every exported symbol.
3. Follow the entity pattern: status const → entity interface → list response
   → resource contract.
4. Run `pnpm build` to validate.

### The response shapes

Four shapes exist: an entity, a collection, an acknowledgement and a report.
Seven composition rules, each structural:

- **A unit type is a single noun** (`Deployment`, `Domain`, `Account`,
  `Activity`, `Token`), never named for the surface that returns it: a list's
  item name leaves no entity to extend, and the create response then restates
  the fields.
- **A response composes its entity, never restates it.**
  `DeploymentCreateResponse extends Deployment`, `TokenCreateResponse extends
  Token`, `DomainSetResult extends Domain`; request-scoped and one-time fields
  (`claim`, `secret`, `isCreate`) live on the response. `GET /account`
  answers the bare `Account`: a browser's person facts come from its session,
  and the credential's kind has no reader.
- **A list response is `ListResponse` plus its plural noun.** The cursor is
  declared once, so a new list cannot get the envelope wrong, and "no
  `total`" is stated once.
- **An acknowledgement is a projection of the resource.** Where a mutation
  leaves no entity, it answers with the resource noun carrying the item's key,
  plus the resource's own state field where the state changed
  (`DeploymentDeleteResponse.status`, `AccountDeleteResponse.plan`); a hard
  delete is the key alone (`DomainDeleteResponse`, `TokenDeleteResponse`). No
  `message`: every surface composes its own copy. **The test is what the field
  IS, not how predictable its value is**: `status` is always `'deleting'` but
  is a field of `Deployment`, so a client renders it with code it has;
  `changed`, `queued` and `success` belong to no entity and only assert the
  call worked, which the status code said. Sync versus accepted is the status
  code's job (200 / 202). The law is written once, on
  `DeploymentDeleteResponse`; the others link to it.
- **A report answers a question and carries only the answer.** The largest
  shape: `PlatformLimits`, `LabelsResponse`, `SetupInstructionsResponse`,
  `DomainRecordsResponse`, `DomainDnsResponse`, `DomainShareResponse`,
  `DomainValidateResponse`, `SPACheckResponse`, `PingResponse`,
  `AccountKeyResponse`. It names no resource it did not compute and restates
  nothing the status code said: `GET /ping` answers with the server clock,
  because a 200 IS the liveness answer. **Booleans only when they ARE the
  answer**: `valid`, `isSPA`, `available` answer the question; `success`,
  `changed`, `queued` assert the call happened. Reports share a LAW, not a
  type: an error body has one shape, so `ErrorResponse` is one type, while a
  report body IS the product; a shared base would admit every banned field.
  `tests/response-shapes.test.ts` walks this package and fails on one.
- **A published contract names every shape it exposes.** No anonymous object
  type in an exported signature, as a return, as options
  (`DeploymentSetOptions`, `DomainSetOptions`, `TokenCreateOptions`) or nested
  in a response (`DnsLookup`): an inline shape cannot be imported, so every
  consumer that holds one redeclares it.
- **One operation, one verb, and destruction is `delete`**: in the method, the
  command, the response type, the activity event and the sentence a user
  reads. HTTP says `DELETE`, the persisted activity events are
  `deployment.delete`, `domain.delete`, `token.delete`, `account.delete`, and
  it is the accurate word (`Map.prototype.delete` destroys; `Element.remove()`
  detaches). **A method whose name disagrees with its own return type is the
  drift announcing itself.**

**One response is outside the shapes, recorded rather than reshaped.**
`GET /deployments/:deployment/config` answers the caller's own `ship.json`,
re-parsed through the public schema from the original the platform keeps, or
`null` when there is none. It projects no platform entity and has no type here,
since its schema is ship.json's, which the API owns; an envelope would make a
caller unwrap a platform shape to reach a document the platform did not
author. `null`, not a 404, because `Deployment.config` already answers "is
there one". A config not yet stored or already cleaned up answers like none; a
missing config on a live deployment is a 500.

**New fields on existing response entities are optional** (`readonly x?: T`),
by the additive-evolution law: published SDK versions return the entity
without the field, and a required one would make every additive API change a
lockstep SDK release (`Account.used` is the precedent). A field may become
required at the entity's next major, once every published consumer carries it.

**The pre-launch exception.** Until this package has external consumers, a
breaking change (a field made required, a type deleted or renamed) may ride a
MINOR, and its release notes name this exception: every consumer is
first-party and releases with this package, so a major buys no reader
anything. It ends the day a package outside the platform depends on this one.

**New error types:** add to `ErrorType` (its JSDoc says who produces it and
what it is distinct from), a static factory on `ShipError`, and its category
in `ERROR_CATEGORIES` (every 4xx-carrying type in `client`; a fault or a state
nowhere). Name any `details` shape a client reads (`BuildFailureDetails`,
`PlanChangeRefusalDetails`), and add the factory, category and wire
round-trip cases to `tests/errors.test.ts`.

### Admin types

**The operator surface does not ship here.** The operator console's types live
with the console and nowhere else: this package is published, so they would
hand every internal field the platform holds to anyone who runs
`npm install`. Do not move them, mirror them, or add a sibling for a new
operator endpoint, even though they have two consumers; the per-account
capacity grant stays out for the same reason. A third consumer means a
private package, never this one.

**Its siblings never entered.** The per-plan request limits and grants have one
holder each, and a fact with one holder needs no owner. `Caps` earned its
place: `Account.usage` and `Account.caps` are the wire, the SDK and the console
both hold it, and a counted kind added on one side only would be silent.

### The credential shape law

Every secret the platform mints obeys three clauses, stated at `CREDENTIAL
SHAPES` in `src/index.ts` and held by `tests/validation-constants.test.ts`
over this package's populations and by the API's suite over the claim code.

1. **One entropy standard.** Every minted random secret is `HEX_LENGTH` hex
   characters. The platform's generators read the constant rather than
   choosing a number, so a minted value and an accepted value cannot differ.
2. **Every BEARER population is named by its prefix**, so a credential says
   what it is before anything parses it. `classifyToken` dispatches three
   populations sharing one `Authorization: Bearer` slot (`ship-` `API_KEY`,
   `deploy-` `DEPLOY_TOKEN`, `oauth-` `OAUTH_TOKEN`), and a value found in a
   log, a ticket or a pasted URL is recognised and revoked on sight.
   - **Two exclusions, by decision.** The deployment claim code is BARE: it
     never enters the Bearer slot (minted into one URL, consumed by one
     endpoint's one field), so its context names it. The OAuth refresh token,
     authorization code and client secret are unprefixed: each is a form field
     posted to an endpoint that knows what it receives, so no dispatcher sees
     one.
   - **Reading the slot has one owner.** `readBearerValue` is the RFC 7235
     §2.1 scheme fold (case-insensitive on the SCHEME, never on the
     credential's bytes), beside `classifyToken` as the other half of one wire
     boundary: `bearer ship-…` is a valid header. **Refused: a `Bearer`
     CONSTANT**, RFC vocabulary, for the reason this package owns no `"POST"`.
     A parser is not a spelling.
3. **No prefix is a prefix of another.** So the populations are named on
   different axes (`ship-` the product, `deploy-` the capability, `oauth-` the
   protocol). `ship-` / `ship-deploy-` looks symmetrical and is a trap: every
   deploy token would match the API-key branch, and correctness would rest on
   the order of two `if`s.

**The clauses are held over a TABLE, not per member.** The populations list in
`tests/validation-constants.test.ts` drives every clause, plus two
completeness rows: no listed population falls through to `OPAQUE`, and each is
validated strictly rather than as a non-empty string. Without them, a constant
with no `classifyToken` branch or `validateToken` arm passes every
table-driven test while doing nothing.

**A prefix is retroactive over every string that already starts with it**
(fixtures using the spelling as an OPAQUE example become malformed members),
so sweep for the spelling before shipping a prefix.

**Not covered, deliberately:** the unsubscribe token is an HMAC-SHA256 output,
not a minted secret; its width is the algorithm's, verified with
`crypto.subtle.verify`, which is constant-time. Truncating it (safe in
principle, RFC 2104 §5) is refused: it would move a correctness guarantee into
a hand-written comparison to shorten a value no person handles.

### Validation: format vs policy

Validators here enforce **wire-format rules**: what a value *is*, not what is
*allowed*. Every consumer (SDK, API, console, integrations) must agree on them
or the wire breaks.

- **Belongs here:** `validateApiKey` (`ship-` plus `API_KEY.HEX_LENGTH` hex
  characters; the width lives in the shape constant, never in prose or a test
  literal), `validateDeployToken` and `validateOAuthToken` (the same shape,
  another prefix), `validatePassword` (length 6 to 128, the envelope an
  endpoint accepts), `validateLabels` (a label's length and shape, the count
  on one resource, no label twice).
- **Stays in the API:** password strength (breach lists, complexity); plan
  caps (delivered by `/limits`); the way forward past a cap
  (`PlatformLimits.suggestions`: which plan sells more and what a grant raises
  are server state, so `/limits` delivers the sentence the API's own refusals
  use, and a client appends it verbatim without learning a plan name); the
  extension blocklist ("The worked split"); domain availability, account
  state, billing rules.

**Rule of thumb:** if a client could compute the answer offline from the input
alone *and* the API would always reject the same input the same way, it is
format and ships here. Otherwise it is policy and stays on the server.

**A fact earns an owner here only when both hold:** two or more independent
holders, and drift between them that would be silent or slow to surface. Loud
drift needs no owner (a stale client whose upload the API refuses by name on
the first try). First check whether the restatement can simply be deleted: a
consumer that never makes the decision cannot disagree about it.

#### One lifetime grammar: `validateTtl`

`ttl` is the platform's word for "how long does this live": seconds until
expiry, omitted for permanent, on both `tokens.create({ ttl })` and the deploy.
One rule serves both, because two ceilings that disagree by a day stay
invisible until someone asks for a duration one accepts and the other refuses.
It also gives token creation its client-side half of dual validation.

**Refused: a per-plan ceiling.** The authenticated entitlement is unbounded,
so the format rule's one-year bound is the only limit, and a policy that does
not exist needs no owner.

Two edges are decisions. **The floor is 1, not 0**: a deployment expiring as
it is created was never live, and `0` is what an unset shell variable coerces
to, so accepting it turns a CI misconfiguration into a vanished deploy. **A
fraction is refused, not rounded**: choosing `1` or `2` for someone who wrote
`1.5` is a decision the platform has no standing to make.

#### The worked split: the blocklist left, the matcher stayed

The extension blocklist looks like one fact and is two.

- **The list is policy.** `virus.exe` is a well-formed filename; refusing it
  is a decision not to be a malware CDN, made at one security boundary and
  changeable the day someone uploads a `.msix`. Published, each tightening
  would need a types release, a ship release and users upgrading, while every
  client enforced the version it pinned; and a stale client's drift is loud
  (the API refuses the file by name). So the list lives in the API and reaches
  clients as `PlatformLimits.blockedExtensions`, derived through `/limits`.
- **The matcher is format.** With the list as data, the API and each client
  read the extension off a name, and that drift is silent where it hurts: a
  client stricter than the server (matching every dot-segment, or reading
  `dir.v1/README` as a `v1/README` file) refuses a legal file without the
  server being asked. Two holders, silent drift: one owner,
  `isBlockedExtension(filename, blocked)`, here.
- **One export, not two.** The extraction helper stays private. "Would
  exporting this be dangerous?" is the wrong test; the right one is whether it
  has earned a place, decided by an asymmetry (adding an export later is free,
  removing one is a major), so with zero callers it stays in.
  `WEB_FILE_EXTENSIONS` is private for another reason: publishing it would
  invite the wrong question.
- **The matcher's fences plant the impossible input.** A black-box test can
  reach the right verdict through a broken reader (a naive `lastIndexOf`
  extracts garbage holding a slash, which matches no entry), and an entry
  planted in the wrong case passes a lowercasing reader. Each fence in
  `tests/validation-constants.test.ts` is proven to fail against the broken
  implementation.

**The general question is which half of a rule is which.** A rule saying
*what a value IS* and a table of *which values are allowed* look like one fact
and are not. When they split: predicate here, table on the server, delivered.

## Design Principles

1. **Single source of truth**: no type duplication anywhere.
2. **Wire format compatibility**: types match the API's JSON exactly.
3. **Readonly by default**: mutable only when necessary.
4. **Const objects over enums**: `as const` for compile-time safety.
5. **JSDoc everything**: the types document themselves.

---

*Types is the foundation. Changes here ripple across the entire platform.*
