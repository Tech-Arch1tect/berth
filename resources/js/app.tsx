import '../css/app.css';

import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { AuthProvider } from './shared/auth/auth-context';
import { OperationsProvider } from './features/operations/contexts/OperationsContext';
import { TerminalPanelProvider } from './features/terminal/contexts/TerminalPanelContext';
import { TerminalPanel } from './features/terminal/components/TerminalPanel';
import { registerServiceWorker } from './shared/pwa/register-sw';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('app');
if (!rootElement) throw new Error('root element #app not found');

const root = createRoot(rootElement);
root.render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <OperationsProvider>
        <TerminalPanelProvider>
          <RouterProvider router={router} />
          <TerminalPanel />
        </TerminalPanelProvider>
      </OperationsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

registerServiceWorker();
