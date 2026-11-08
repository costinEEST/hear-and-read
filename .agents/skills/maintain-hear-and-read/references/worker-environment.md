# Worker environment and commands

Use Node 22.12+ or a newer supported LTS and npm from the repository root. Follow the two-command [README quick start](../../../../README.md#run-locally). `npm ci` installs the committed lockfile; no Python environment is needed.

## Runtime and dependencies

The TypeScript backend runs on Cloudflare Workers, using Web APIs and native HTMLRewriter. Keep it independent of Node-only runtime APIs. `entities` decodes raw text chunks after collection; it does not parse HTML or run scripts. Wrangler supplies local workerd and deployment, TypeScript checks backend types, and Vitest with `@cloudflare/vitest-plugin` runs extraction/API tests in workerd. `@cloudflare/workers-types` supplies runtime types.

Declare dependency changes intentionally with npm and commit `package.json` and `package-lock.json` together. Do not substitute another package manager or upgrade unrelated packages. Keep `node_modules/`, `dist/`, `.wrangler/`, logs, `.dev.vars`, `.dev.vars.*` and `.env*` secrets untracked. Sanitized `.env.example` and `.dev.vars.example` templates may be tracked.

## Local development and assets

`npm run dev` runs Wrangler on `http://127.0.0.1:8765`, runs the asset-copy build, and reloads backend changes. Another port can be selected with `npm run dev -- --port 8766`. Wrangler watches root browser files; its custom build recreates the public asset directory. Stop servers you start; leave pre-existing user servers alone.

The root HTML/CSS/browser JS remains the source of truth. `npm run build` copies only explicit public files to `dist/public/` and writes security headers. Never point `assets.directory` at the root. `/api/*` runs the Worker; existing static assets bypass it. Import endpoints retain the same JSON contract used by the frontend. There is no database or server-side session storage. When adding a public source file, update both the asset allowlist and `build.watch_dir` in `wrangler.jsonc`; do not edit generated assets. Keep the static `_headers` policy and API security headers aligned when changing either policy.

For metadata/domain changes, follow [BRANDING.md](../../../../BRANDING.md). Keep the canonical link, Open Graph URL, absolute sharing-image URLs, JSON-LD, robots sitemap URL and sitemap entry consistent. Rebuild and check that crawler files are served with the right content types. Metadata-only changes need these focused checks and a deployment dry run, not the speech/layout test matrix.

## Verification and deployment

For backend/dependency changes run:

```sh
npm run typecheck
npm test
npm run deploy:check
```

`npm test` runs existing browser-logic tests and workerd fixture/API tests. `npm run test:browser-logic` or `npm run test:worker` narrows the scope. `npm run deploy:check` bundles without publishing, and invokes the asset build. Type checking includes backend and Worker tests; Vite raw fixture imports are declared in `tests/worker/fixtures.d.ts`.

Exercise affected endpoints through local Wrangler when changing integration behavior. Fixture tests do not prove live publisher access, audible browser speech or production CPU usage. Preserve manual-paste/retry guidance for declined automated access.

Deployment instructions are in [the README](../../../../README.md#deploy-to-cloudflare). Deploying updates the named Worker in the authenticated account; a dry run does not require publication. Use Workers Free for the user's free hosting goal; do not introduce paid bindings or browser automation. Check current platform limits and measure production imports before claiming all pages fit the free CPU allowance.
