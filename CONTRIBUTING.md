# Contributing

This toolkit grows by a model we call **expand the perimeter**: each week we push the boundary of what the toolkit covers outward by exactly one solid, well-understood item. One Temrel issue, one new tool or skill, added here as a self-contained folder. No big-bang dumps, no half-finished experiments.

## The contribution model

Every item is a **self-contained folder** under the element directory it belongs to. Pick the element first, then add your folder there:

- `context/` : context engineering
- `tools/` : tools and tool design
- `skills/` : agent skills (under `model-invoked/` or `human-invoked/`, by who triggers the skill)
- `evals/` : evals and verification
- `orchestration/` : orchestration and multi-agent workflows
- `guardrails/` : guardrails and security

Each item folder ships with its own `README.md` containing:

1. **What** it is, in one line.
2. **Why** it exists, in one line.
3. A link back to the **Temrel issue** that introduced it.
4. A **subscribe link**: `https://spark.temrel.com/subscribe?utm_source=github&utm_medium=repo&utm_campaign=toolkit`

After adding the folder, add one row to the index table in the root [README.md](./README.md) so people can find it.

## The quality bar

- **One genuinely useful item beats four toys.** If you are not sure it earns its place, it does not go in.
- **Keep items small, independent, and low-maintenance.** An item should stand on its own, with no shared build step and no cross-item coupling. Browser-only and zero-dependency wins where possible, so it can run on GitHub Pages for free.
- **If an item does not fit one of the six elements, it does not belong here.** The six elements are the whole map. Anything outside them belongs in a different repo.

## Adding an item, step by step

1. Choose the element folder.
2. Create `your-item/` inside it.
3. Build the item so it is self-contained (a single `index.html` is ideal for browser tools).
4. Write `your-item/README.md` with the what, why, issue link, and subscribe link.
5. Add a row to the index table in the root README.
6. Open a pull request.

## Style

Prose in this repo avoids the em dash character. Use colons, commas, parentheses, or full stops instead.
