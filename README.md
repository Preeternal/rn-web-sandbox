# React Native Web Sandbox

Payback balances and claims, built with Expo, React Native, TypeScript and Expo Router for mobile and desktop browsers.

## Live app

[Open the app](https://preeternal.github.io/rn-web-sandbox/)

Enter your API token on first open. The app validates it before saving it in browser storage. Use **Logout** to enter a different token. Tokens are supplied at runtime and are not included in the build.

## Run locally

Use Node.js 22 and Yarn 4.18.1 (the version pinned in `package.json`).

```bash
corepack enable
yarn install --immutable
cp .env.example .env.local
```

Set `EXPO_PUBLIC_BASE_URL` in `.env.local` to the API base URL provided with the task, then start the app:

```bash
yarn expo start --web
```

Open [http://localhost:8081/](http://localhost:8081/) or the address printed by Expo. Development runs at `/`; `/rn-web-sandbox/` is the deployed build's base path. Enter the token in the app, not in the environment file.

Claim submission requires browser support for Web Crypto and Web Locks, over HTTPS or localhost.

Validation and build commands:

```bash
yarn vitest run
yarn expo lint
yarn tsc --noEmit
yarn expo export --platform web
```

The static build is generated in `dist/`, with `/rn-web-sandbox/` configured for GitHub Pages. The API base URL must also be set in the build environment.

## What works

- **Authentication:** token validation, browser persistence, Logout and session isolation. An API `401` from the current session returns to the login screen.
- **Balances (Home):** available, pending and claiming amounts per asset, their combined USD estimate, server snapshot freshness, loading and empty states, retry and manual refresh. Balances refresh every 30 seconds and remain fresh in the query cache for 5 seconds.
- **Claim:** asset and destination selection, amount entry, Max, input validation, fee and receive amount preview, confirmation, and status tracking until completion or failure.
- **Recovery:** the exact request body and idempotency key are saved before submission. Unknown outcomes can be recovered after a timeout, reload or another login with the same token. Cross-tab locking prevents concurrent submissions; one unresolved operation is allowed per token.
- **Balance reconciliation:** the server snapshot stays visible alongside the operation status. A new Claim becomes available after the previous operation is resolved and a newer balance snapshot is received.
- **Money correctness:** decimal strings and `big.js` preserve precision. Zod validates request and response contracts, including `amount = fee + receiveAmount`. Tests cover amount rules, totals, API contracts, session changes and Claim recovery.

Activity history is not implemented. Automated tests use API fixtures; live API and phone-browser verification are manual. See [NOTES.md](NOTES.md) for decisions, AI collaboration and known limitations.
