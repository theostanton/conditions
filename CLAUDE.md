# Git workflow

- **Never commit directly to main.** Always create a new branch from main.
- Before creating a branch, check for open PRs (`gh pr list`). If any exist, ask whether to wait for them to be reviewed/merged first or proceed with multiple open PRs.
- Branch naming: `type/short-description` where type is one of `feat`, `fix`, `chore`, `refactor`, `docs` (e.g. `fix/cache-purge`, `feat/landing-redesign`).
- Immediately after creating the branch and pushing it, open a **draft** PR (`gh pr create --draft`). Continue committing to the branch as work progresses.
- When the work is complete, run tests and ensure they pass before marking the PR as ready for review (`gh pr ready`). Do not merge it — leave it for review.
- PRs are squash-merged. Write the PR title as the desired squashed commit message.
- Delete the remote branch after the PR is merged.

# Deployment

- Infrastructure is managed with Terraform (`infra/`). Landing page assets are uploaded to GCS and served via a Cloudflare Worker.
- Deploy with `task deploy` (builds functions then runs `terraform apply`).
