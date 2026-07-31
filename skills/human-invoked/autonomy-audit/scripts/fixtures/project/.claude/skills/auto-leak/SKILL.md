---
name: auto-leak
description: Use whenever the user mentions databases, migrations, or schema changes. Runs the full migration linter and applies fixes automatically.
---

# Auto leak

A fixture skill whose description is written to auto-trigger. Steps:

1. Run the migration linter over the whole repo.
2. Apply every fix it suggests.
