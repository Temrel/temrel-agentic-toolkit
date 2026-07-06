# model-router (CLI)

Calibrate your model-tier choices against what you actually do. `model-router` reads your local Claude Code session transcripts (`~/.claude/projects/<project>/<session>.jsonl`) and answers three questions:

- **`report`** — what did each session and each model cost me?
- **`audit`** — which sessions ran on an Opus-tier model but look like they didn't need it, and what did that cost?
- **`calibrate`** — where do my habits disagree with the [model-router skill](../../skills/model-invoked/model-router/)'s four-axis heuristic?

It is the companion to the `model-router` skill: the skill recommends a tier before you start; the CLI checks the recommendation against your real usage after the fact.

**Guarantees:** read-only (never writes to or modifies transcripts), no network calls anywhere, dollar figures always cite the pricing file's `verified_on` date.

## Install

```sh
cd tools/model-router
npm install
npm run build
npm link        # optional: puts `model-router` on your PATH
```

Requires Node 20+. During development, `npm run dev -- report` runs from source via tsx.

## Usage

```sh
model-router report [--project <path>] [--since <days>] [--json]
model-router audit  [--project <path>] [--since <days>] [--json]
model-router calibrate [--project <path>] [--since <days>] [--json]
```

- `--project` accepts a real path (`/Users/you/code/myapp`) or the encoded directory name Claude Code uses (`-Users-you-code-myapp`).
- `--since` defaults to 30 days. **Note:** Claude Code transcripts older than ~30 days may already be deleted, so a larger window only helps if the files still exist. Every report prints the actual date range covered by the data so the window is explicit.
- `--json` switches from the human-readable table to machine-readable JSON.
- `--pricing <file>` points at an alternative pricing file; `--projects-root <dir>` overrides the transcript location (used by tests).

### `report`

Per-model and per-session breakdown: sessions, tokens by type (input / output / cache write / cache read), estimated cost, and cost per session.

### `audit` (v1 heuristic)

Flags sessions that ran on an Opus-tier model but had low tool-call count, few assistant turns, **and** short duration — likely overkill. Estimated overspend per session is (actual cost) − (same tokens at Sonnet 5 rates), with a total at the bottom. Thresholds live in [`router.config.json`](./router.config.json).

### `calibrate` (v1 proxies)

Scores each session on the skill's four axes using observable proxies, then compares the heuristic's recommended tier with the model tier actually used. The v1 proxies (configurable in `router.config.json`):

| Axis | Proxy | Rationale |
| --- | --- | --- |
| Scope | distinct files touched (Edit/Write) | more files ≈ wider blast radius |
| Novelty | human prompt turns | more back-and-forth ≈ less well-trodden ground |
| Risk | distinct files touched | crude v1 stand-in; risk isn't directly observable |
| Iteration | tool-call count | long agentic sessions make many tool calls |

These are approximations — novelty and risk in particular are not really observable from transcripts. Treat calibrate output as a conversation starter, not a verdict.

## Pricing

Rates live in [`pricing.json`](./pricing.json), per model, per million tokens: `input`, `output`, `cache_write_5m` (5-minute-TTL cache writes), `cache_write_1h` (1-hour-TTL), and `cache_read`. The file carries a `verified_on` date that every dollar figure cites.

> **⚠️ The shipped rates are placeholders.** Verify them against <https://claude.com/pricing> before trusting any dollar figure, and update `verified_on` when you do.

Model lookup is exact-match first, then longest key prefix (so `claude-opus-4-9-<anything>` falls back to the `claude-opus` entry). Unknown models are reported as unpriced rather than guessed. Cache writes with no TTL breakdown in the transcript are priced at the cheaper 5m rate (a deliberate slight underestimate).

## How parsing works (and its limits)

- Assistant usage is **deduped by API message id** — Claude Code writes one JSONL entry per content block, all sharing the same `message.id` and identical usage; naive summing inflates cost ~2–3×.
- `<synthetic>` model entries (harness-generated) are excluded.
- Unparseable lines are counted and skipped, never fatal — the transcript schema drifts across Claude Code versions.
- Subagent (sidechain) usage is included: it is real spend.
- Costs are estimates from list prices; they don't know about your plan, rate-limit tier, or batch discounts.

## Tests

```sh
npm test
```

Fixtures under `test/fixtures/` mirror the real transcript structure (anonymized), including the duplicate-message-id quirk, a synthetic-model entry, and a deliberately corrupt line.

[Subscribe to Temrel](https://spark.temrel.com/subscribe?utm_source=github&utm_medium=repo&utm_campaign=toolkit) for a new item every week.
