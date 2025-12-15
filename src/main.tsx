import '@/lib/errorReporter';
import { enableMapSet } from "immer";
enableMapSet();
import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
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
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/layout/AppLayout';
const queryClient = new QueryClient();
const ResultPage = lazy(() => import('@/pages/ResultPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const AdminLeadDetailPage = lazy(() => import('@/pages/AdminLeadDetailPage'));
const AdminSuspenseFallback = () => (
  <div className="p-8">
    <Skeleton className="h-12 w-1/3 mb-8" />
    <Skeleton className="h-64 w-full" />
  </div>
);
const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/result/:leadId",
    element: (
      <Suspense fallback={<div className="w-full h-screen flex items-center justify-center"><Skeleton className="h-64 w-full max-w-2xl" /></div>}>
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
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
)