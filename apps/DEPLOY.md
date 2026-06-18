# Deployment

Both apps ship to **Cloudflare Pages** (direct upload) on the account
`grkmyldz58@gmail.com` (`c17df790c848837e82290566cdf245a4`).

| App                | Pages project             | pages.dev                              | Custom domain              |
| ------------------ | ------------------------- | -------------------------------------- | -------------------------- |
| `apps/site`        | `opticalcenter`           | `opticalcenter.pages.dev`              | `opticalcenter.dev`        |
| `apps/playground`  | `opticalcenter-playground`| `opticalcenter-playground.pages.dev`   | `play.opticalcenter.dev`   |

## Automated (CI/CD)

`.github/workflows/deploy.yml` builds the library + both apps and deploys them:

- **push to `main`** → production deploy
- **pull request** → per-branch preview deploy (skipped for forks)

It needs one repo secret:

- `CLOUDFLARE_API_TOKEN` — a token with **Account › Cloudflare Pages › Edit**.

The account id is non-secret and lives inline in the workflow `env`.

## Manual deploy

```sh
npm ci
npm run build              # library (tsc)
npm run build:site
npm run build:playground
npx wrangler pages deploy apps/site/dist        --project-name opticalcenter            --branch main
npx wrangler pages deploy apps/playground/dist  --project-name opticalcenter-playground --branch main
```

## Custom domains

Attached on the Pages project (zone `opticalcenter.dev` lives on the same
account, so the CNAME is provisioned automatically). Set once via the dashboard
(Pages → project → Custom domains) or the API.
