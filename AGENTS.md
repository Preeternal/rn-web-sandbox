This is an Expo/React Native application targeting web browsers, including small mobile screens. Prioritize responsive mobile-first layouts, usability across desktop and mobile browsers, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch <https://docs.expo.dev/llms.txt> — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Dependency Management

- All dependencies are installed, updated, and removed exclusively by the user.
- Never run package installation, update, or removal commands without explicit user approval.
- If a dependency is missing or required, explain why it is needed and provide the exact installation command. Wait for the user to install it.
- Use `yarn expo install <package>` for Expo SDK-dependent packages.
- Use `yarn add <package>` for regular JavaScript dependencies.
- Use `yarn add -D <package>` for development dependencies.
- Never modify `package.json`, `yarn.lock`, or `.yarnrc.yml` without explicit user approval.

## Commands

```bash
yarn expo start --web       # start the dev server
yarn expo export --platform web  # build static web output
yarn expo lint               # lint
yarn tsc --noEmit            # typecheck
yarn expo-doctor             # diagnose dependency and config issues
yarn vitest run              # run tests
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for navigation. Routes and layouts live in `src/app/`. Keep reusable components, hooks, services, and utilities outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: <https://docs.expo.dev/router/introduction.md>

## Deployment

GitHub Pages deployment has been configured and verified.

Never commit, push, rebase, reset, force-push, deploy, publish,
or trigger GitHub Actions without explicit user approval.

Deployment is exclusively controlled by the user.
The user personally handles all deployments.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: <https://docs.expo.dev/versions/latest/index.md>
- When asked for advice, review, or recommendations, respond with suggestions only. Do not edit files.
