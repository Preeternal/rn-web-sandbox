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

## TypeScript Naming

- Prefix every locally declared type alias and interface with `T`, for example `TSession` or `TTokenScreenProps`.
- Keep the original names of types imported from third-party libraries.

## TypeScript Type Organization

- Keep shared or reused project-defined type aliases and interfaces under two branches: `src/types/entities/` and `src/types/features/`.
- Put reusable entity/data models in `src/types/entities/<entity>.ts`, for example `src/types/entities/session.ts`.
- Put shared or reused feature-specific contracts, component props, hook types, API request/response types, and other technical types in `src/types/features/<feature>.ts`.
- A type alias or interface may be declared locally in an implementation file if it is used exactly once, only within that file, and is not exported or shared. Keep the `T` prefix for these local types too.
- Move a local type to the appropriate `entities/` or `features/` file when it becomes reused or shared. Do not introduce adjacent `types.ts` files or type files directly under `src/types/`.
- Use kebab-case filenames and explicit `import type` / `export type`. Import directly from the owning file instead of introducing a global barrel of unrelated types.
- Keep runtime schemas and logic outside type-only files. Derive types from Zod schemas instead of manually duplicating the same contract.

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
