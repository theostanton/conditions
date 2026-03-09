# Git workflow

- **Never commit directly to main.** Always create a new branch from main.
- Before creating a branch, check for open PRs (`gh pr list`). If any exist, ask whether to wait for them to be reviewed/merged first or proceed with multiple open PRs.
- Branch naming: `type/short-description` where type is one of `feat`, `fix`, `chore`, `refactor`, `docs` (e.g. `fix/cache-purge`, `feat/landing-redesign`).
- Immediately after creating the branch and pushing it, open a **draft** PR (`gh pr create --draft`). Continue committing to the branch as work progresses.
- When the work is complete, run tests and ensure they pass before marking the PR as ready for review (`gh pr ready`). Do not merge it — leave it for review.
- PRs are squash-merged. Write the PR title as the desired squashed commit message.
- Delete the remote branch after the PR is merged.

# PR review and merge process

- Before merging any PR, thoroughly review the diff (`gh pr diff`) for correctness, security issues, and adherence to project conventions.
- Only deploy from main after merging a PR — never deploy from a feature branch.
- After deploying, run verification steps for the new feature AND smoke tests on the whole stack (Telegram bot webhook responds, WhatsApp webhook responds, cron function exists, landing page loads) to check for regressions.
- If any smoke test fails, immediately revert the PR (`git revert`), redeploy from main, then debug what went wrong on a new branch.

# Deployment

- Infrastructure is managed with Terraform (`infra/`). Landing page assets are uploaded to GCS and served via a Cloudflare Worker.
- Deploy with `task deploy` (builds functions then runs `terraform apply`).

# Smoke tests

After every deploy, verify:
1. `curl -s -o /dev/null -w '%{http_code}' https://conditionsreport.com/` returns 200 (landing page)
2. `curl -s -o /dev/null -w '%{http_code}' -X POST https://bot-dmytevhowa-ew.a.run.app` returns non-5xx (Telegram webhook)
3. `curl -s -o /dev/null -w '%{http_code}' https://whatsapp-dmytevhowa-ew.a.run.app?hub.mode=subscribe&hub.verify_token=test&hub.challenge=test` returns 200 or 403 (WhatsApp webhook alive)
4. Any new feature-specific verification steps
