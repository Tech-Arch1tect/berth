import '../css/app.css';

import { createRoot } from 'react-dom/client';
import { createInertiaApp } from '@inertiajs/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OperationsProvider } from './contexts/OperationsContext';
import { TerminalPanelProvider } from './contexts/TerminalPanelContext';
import { TerminalPanel } from './components/terminal/TerminalPanel';
import Layout from './shared/layout/Layout';

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

type InertiaPageModule = {
  default: React.ComponentType<unknown> & {
    layout?: (page: React.ReactElement) => React.ReactElement;
  };
};

const oldPages = import.meta.glob('./pages/**/*.tsx', { eager: true }) as Record<
  string,
  InertiaPageModule
>;
const newPages = import.meta.glob(['./features/**/pages/**/*.tsx', './shared/**/pages/**/*.tsx'], {
  eager: true,
}) as Record<string, InertiaPageModule>;

const pageMap: Record<string, string> = {
  'Errors/Generic': './shared/errors/pages/Generic.tsx',
  'Sessions/Index': './features/sessions/pages/Index.tsx',
  'Setup/Admin': './features/setup/pages/Admin.tsx',
};

function resolvePage(name: string): InertiaPageModule['default'] {
  const mappedPath = pageMap[name];
  if (mappedPath) {
    const moved = newPages[mappedPath];
    if (!moved) {
      throw new Error(`Page "${name}" mapped to "${mappedPath}" but file is missing`);
    }
    return moved.default;
  }
  const fallback = oldPages[`./pages/${name}.tsx`];
  if (!fallback) {
    throw new Error(`Page not found: ${name}`);
  }
  return fallback.default;
}

createInertiaApp({
  title: (title) => `${title} - ${appName}`,
  resolve: (name) => {
    const Component = resolvePage(name);
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
            <TerminalPanel />
          </TerminalPanelProvider>
        </OperationsProvider>
      </QueryClientProvider>
    );
  },
  progress: {
    color: '#4B5563',
  },
});
