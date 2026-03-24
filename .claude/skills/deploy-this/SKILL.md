---
name: deploy-this
description: Deploy WikiLoop DoubleCheck to Vercel, Toolforge, and/or other targets
disable-model-invocation: true
allowed-tools:
  - Bash
  - Read
argument-hint: "[targets: vercel|toolforge|extension|all] [--no-bump] [--dry-run]"
---

# Deploy WikiLoop DoubleCheck

Run the unified deploy script at `scripts/deploy.sh`.

## Steps

1. Run `bash scripts/deploy.sh $ARGUMENTS` from the project root
2. Monitor the output for errors
3. Report the deployment status including version, targets, and URLs

## Important

- The deploy script sources credentials from `~/.env` — never log or display credential values
- If no arguments are provided, it deploys to ALL targets (vercel, toolforge, extension, userscript)
- Use `--dry-run` to preview what would happen without making changes
- Use `--no-bump` to skip version bump
- The script uses `$XINBENLV_PAT_FOR_WIKILOOP` for git push — ensure it is set in `~/.env`

## Targets

| Target | URL |
|--------|-----|
| vercel | https://doublecheck.wikiloop.org |
| toolforge | https://wikiloop-doublecheck.toolforge.org |
| extension | Chrome Web Store (manual upload) |
| userscript | Served from Toolforge |
