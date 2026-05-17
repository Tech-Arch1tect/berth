import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Toaster } from '../shared/utils/toast';
import { theme } from '../shared/theme';

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          className: theme.toast.container,
        }}
      />
    </>
  ),
});
