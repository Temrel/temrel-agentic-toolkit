# Triggers

The point of the verification layer is that it fires without you remembering to fire it. These are three ways to wire `verify.sh` onto a trigger, from simplest to most integrated. They assume you copied the starter into your repo as `verification/`; adjust the paths if you put it somewhere else.

## 1. Git pre-push hook

Blocks a push while a tier 1 gate is failing. This is the "one mandatory gate the agent cannot merge past".

```sh
cp verification/triggers/pre-push.sh .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

See [pre-push.sh](./pre-push.sh). It runs `verify.sh gates` and exits non-zero on failure, which aborts the push.

## 2. Claude Code hook

Runs the gates automatically every time the agent finishes a turn, so a broken build is caught the moment it happens instead of at review time. Add to `.claude/settings.json` in your repo:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "./verification/verify.sh gates" }
        ]
      }
    ]
  }
}
```

A non-zero exit feeds the failure back to the agent, which will usually fix it on the spot. That is the loop working for you.

## 3. Watch loop

The blunt instrument: re-run the gates on an interval while an agent works in another pane.

```sh
while true; do ./verification/verify.sh gates; sleep 300; done
```

## What about CI?

You can absolutely run `verify.sh gates` and `verify.sh eval` in CI too, and eventually you should. But triggers that fire during the work (hooks) catch failures minutes earlier than triggers that fire after the push, and with agents producing more PRs than before, earlier is where the audit tax gets paid down.
