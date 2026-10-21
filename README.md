# React Native Web Sandbox

## Expo Configuration

Expo SDK 58 with Expo Router and static web output.

The following settings are already configured in app.json:

- web.output: "static"
- experiments.baseUrl: "/rn-web-sandbox"

## Screens

- Home (`/`): a protected placeholder with a Logout action.
- Auth (`/auth`): enter and save a token to open Home.

Routes are relative to the configured base path. A `401` from the current API
session clears the token and returns to Auth. Tokens are saved in browser storage.

## Install dependencies

```bash
yarn install
```

## Start the app

Copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_BASE_URL` to your API URL.
Local environment files are ignored by Git. The URL is included in the web build;
never put API tokens in environment variables used by the client.
For CI builds, set `EXPO_PUBLIC_BASE_URL` in the build environment before running
`yarn expo export --platform web`.

```bash
yarn expo start --web
```

## Other commands

```bash
yarn expo install <package>  # Expo SDK-dependent packages
yarn add <package>           # Regular JavaScript dependencies
yarn add -D <package>        # Development dependencies
yarn expo install --fix      # fix incompatible package versions
```

## Build

Run from the project root:

```bash
yarn expo export --platform web
```

The static website is generated in dist/.

## Local Production Preview

IMPORTANT: Do not use `npx serve dist` directly.

GitHub Pages serves this repository under /rn-web-sandbox/,
so the local server must reproduce that directory structure.

Run from the project root:

```bash
mkdir -p /tmp/expo-pages-test
ln -sfn "$PWD/dist" /tmp/expo-pages-test/rn-web-sandbox
yarn dlx serve /tmp/expo-pages-test
```

Open:

<http://localhost:3000/rn-web-sandbox/>

## Deployment

GitHub Pages is the configured deployment target.

Use GitHub Actions to build and deploy the contents of dist/.

Do not commit dist/ to the main branch.

GitHub Pages deployment has been configured and verified.

```bash
yarn install --immutable
yarn expo export --platform web
```

Repository: Preeternal/rn-web-sandbox

Production URL:

<https://preeternal.github.io/rn-web-sandbox/>

### Tests

Run tests:

```bash
yarn vitest run
```
