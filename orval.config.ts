import { defineConfig } from 'orval';

export default defineConfig({
  berth: {
    input: {
      target: './openapi.json',
    },
    output: {
      mode: 'tags-split',
      target: './resources/js/api/generated',
      schemas: './resources/js/api/generated/models',
      tsconfig: './tsconfig.node.json',
      client: 'react-query',
      httpClient: 'fetch',
      override: {
        mutator: {
          path: './resources/js/api/client.ts',
          name: 'apiClient',
        },
        fetch: {
          includeHttpResponseReturnType: false,
        },
      },
    },
  },
});
