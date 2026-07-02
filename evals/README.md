# Evals and verification

One of the six elements of agentic engineering. This is about **knowing whether the agent actually did the job**: eval harnesses, test fixtures, scoring rubrics, and verification utilities that turn "looks right" into "measurably right". Without evals you are shipping on vibes, and agentic systems regress quietly.

## What belongs here

Eval harnesses, golden-output checkers, rubric-based graders, regression suites for prompts and skills, and verification utilities (for example, checks that an agent's output compiles, passes tests, or matches a spec).

## Items

- [verification-starter](./verification-starter/): a copy-me verification layer for agent-written code. Deterministic gates, an LLM-as-judge diff review against stated intent, and a small eval harness that scores the judge against your recorded failures. Plus a browser page that generates your config.

## Contributing

Have an eval harness or a verification utility worth sharing? See [CONTRIBUTING.md](../CONTRIBUTING.md). One genuinely useful item beats four toys.

[Subscribe to Temrel](https://spark.temrel.com/subscribe?utm_source=github&utm_medium=repo&utm_campaign=toolkit) for a new item every week.
