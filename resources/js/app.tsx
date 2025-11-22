import './bootstrap';
import '../css/app.css';

import { createRoot } from 'react-dom/client';
import { createInertiaApp } from '@inertiajs/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OperationsProvider } from './contexts/OperationsContext';
import { TerminalPanelProvider } from './contexts/TerminalPanelContext';
import Layout from './components/layout/Layout';

const appName = 'Berth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createInertiaApp({
  title: (title) => `${title} - ${appName}`,
  resolve: (name) => {
    const pages = import.meta.glob('./pages/**/*.tsx', { eager: true }) as Record<
      string,
      {
        default: React.ComponentType<unknown> & {
          layout?: (page: React.ReactElement) => React.ReactElement;
        };
      }
    >;
    const page = pages[`./pages/${name}.tsx`];
    if (!page) {
      throw new Error(`Page not found: ${name}`);
    }

    const Component = page.default;

    if (!Component.layout) {
      Component.layout = (page) => <Layout>{page}</Layout>;
    }

    return Component;
  },
  setup({ el, App, props }) {
    const root = createRoot(el);
    root.render(
      <QueryClientProvider client={queryClient}>
        <OperationsProvider>
          <TerminalPanelProvider>
            <App {...props} />
          </TerminalPanelProvider>
        </OperationsProvider>
      </QueryClientProvider>
    );
  },
  progress: {
    color: '#4B5563',
  },
});
