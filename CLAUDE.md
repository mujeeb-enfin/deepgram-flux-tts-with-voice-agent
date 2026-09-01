# CLAUDE

All product specific  DEMO files should be placed in the product id or name specific folder.

_Memory file for the Claude agent._

<!-- MR-MULTI-CODER:CODER-REF -->
## Project conventions

Read **@CODER.md** (at the repository root) first. It is the single source
of truth for how to work on this codebase. Treat its rules as binding for every task.

See also: [././CODER.md](././CODER.md)
<!-- /MR-MULTI-CODER:CODER-REF -->

## Hard rules

- **NEVER rename existing variables, constants, functions, or exports** without explicit owner approval. Add new ones alongside if needed — never change existing names.
- **No bandaids, no trickery — enterprise-grade only.** Every fix must address the ROOT CAUSE, not paper over symptoms. If the proper fix is too large for the current scope, document the gap explicitly and get approval — never silently ship a shortcut.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
