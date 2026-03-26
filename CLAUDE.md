# WikiLoop DoubleCheck — Claude Code Guidelines

## Deployment

After completing code changes and pushing to git, ALWAYS deploy to ALL targets (Vercel, Toolforge, etc.) without waiting to be asked. Never consider a task done until deployment is confirmed.

## Debugging Guidelines

When diagnosing issues, verify the root cause before jumping to fixes. If an external service is down (not rate-limited), switch providers directly rather than trying workarounds on the broken provider.

## Tech Stack

This is a TypeScript-first monorepo (pnpm workspaces). Use TypeScript for all new code. When working with Vercel, remember that serverless functions have limitations: no long-running SSE streams, pnpm module resolution quirks, and catch-all routes need explicit path matching.

## Task Agents / Parallel Work

When parallel Task agents need to commit to git, use a sequential commit strategy (queue or lock file) to avoid git lock conflicts. Never have multiple agents commit concurrently.

When spawning Task sub-agents, ensure they have all required tool permissions (especially Bash). If sub-agents need file system or git access, explicitly grant those permissions or have the orchestrator handle those steps.

## Testing Strategy

Before writing implementation code for non-trivial fixes or features, write a failing test (or shell script with assertions) that defines what success looks like. Implement the solution and iterate until all tests pass. If you hit a dead end after 3 attempts with one approach, STOP and propose an alternative before continuing.

## Headless Mode

For routine deploy-and-verify workflows or batch operations, use headless mode:
```sh
claude -p "Build the project, deploy to Vercel and Toolforge, verify both are live, and report status" --allowedTools "Bash,Read,Glob"
```
