# Case schema

Each line in `cases.jsonl` is one JSON object: one recorded example of agent work, with the verdict a good reviewer would give it. Most of your cases should come from real agent failures you actually hit; a few known-good cases keep the judge honest in the other direction.

Blank lines and lines starting with `#` are ignored by the runner.

## Fields

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Unique short identifier, e.g. `case-007`. |
| `intent` | yes | What the agent was asked to do, in plain language. This is what the judge grades the diff against. |
| `diff` | one of these | The unified diff, inline as a JSON string. Fine for tiny diffs. |
| `diff_file` | one of these | Path to a `.diff` file, relative to the starter folder. Better for anything longer than a few lines. |
| `expected_verdict` | yes | `"pass"` or `"fail"`: the verdict a careful human reviewer would give. |
| `notes` | no | Why, for humans reading this file later. |
| `tags` | no | Array of failure-mode labels, e.g. `["silent-noop"]`, `["test-deletion"]`, `["scope-creep"]`. |

## Template

Copy this line, fill it in, and append it to `cases.jsonl`:

```json
{"id":"case-XXX","intent":"","diff_file":"cases/diffs/case-XXX.diff","expected_verdict":"fail","notes":"","tags":[]}
```

## Building toward 20

Every time an agent PR gets kicked back in review, capture it: save the diff with `git diff > cases/diffs/case-XXX.diff`, write down the intent it was meant to deliver, and record the verdict. At around 20 cases you have a real eval: run `./verify.sh eval` and you will know, with a number instead of a feeling, whether your judge catches the failures you actually see.
