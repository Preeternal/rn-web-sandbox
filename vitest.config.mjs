import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests use adapters and mocks rather than the deployment's API endpoint.
    env: { EXPO_PUBLIC_BASE_URL: 'https://api.example.test' },
  },
});
