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
      client: 'react-query',
      httpClient: 'axios',
      override: {
        mutator: {
          path: './resources/js/lib/api.ts',
          name: 'apiClient',
        },
        query: {
          useQuery: true,
          useMutation: true,
        },
      },
    },
  },
});
