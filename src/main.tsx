import '@/lib/errorReporter';
import { enableMapSet } from "immer";
enableMapSet();
import { StrictMode, lazy, Suspense } from 'react'
import { createRoot, Root } from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import '@/index.css'
import { HomePage } from '@/pages/HomePage'
import '@/lib/i18n'; // Initialize i18next
import { AppLayout } from '@/components/layout/AppLayout';
import { AdminSuspenseFallback } from '@/components/AdminSuspenseFallback';
const queryClient = new QueryClient();
const ResultPage = lazy(() => import('@/pages/ResultPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const AdminLeadDetailPage = lazy(() => import('@/pages/AdminLeadDetailPage'));
const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/result/:leadId",
    element: (
      <Suspense fallback={<AdminSuspenseFallback />}>
        <ResultPage />
      </Suspense>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/admin",
    element: (
      <AppLayout container>
        <Suspense fallback={<AdminSuspenseFallback />}>
          <AdminPage />
        </Suspense>
      </AppLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/admin/leads/:leadId",
    element: (
      <AppLayout container>
        <Suspense fallback={<AdminSuspenseFallback />}>
          <AdminLeadDetailPage />
        </Suspense>
      </AppLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
]);
const container = document.getElementById('root')!;
let root: Root | null = null;
const App = () => (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>
);
if (container) {
  if (!root) {
    root = createRoot(container);
  }
  root.render(<App />);
}
// This satisfies the linter rule for fast refresh
export {};