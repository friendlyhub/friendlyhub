import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/auth';
import Layout from './components/Layout';
import Home from './pages/Home';
import Browse from './pages/Browse';
import AppDetail from './pages/AppDetail';
import AuthCallback from './pages/AuthCallback';
import Setup from './pages/Setup';
import SetupDistro from './pages/SetupDistro';
import Manifesto from './pages/Manifesto';
import Privacy from './pages/Privacy';
import InstallApp from './pages/InstallApp';

const MyApps = lazy(() => import('./pages/MyApps'));
const NewApp = lazy(() => import('./pages/NewApp'));
const SubmitVersion = lazy(() => import('./pages/SubmitVersion'));
const SubmissionDetail = lazy(() => import('./pages/SubmissionDetail'));
const VerifyApp = lazy(() => import('./pages/VerifyApp'));
const ReviewQueue = lazy(() => import('./pages/ReviewQueue'));
const AdminApps = lazy(() => import('./pages/AdminApps'));
const Users = lazy(() => import('./pages/Users'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Loading() {
  return <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ReviewerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return <Loading />;
  if (!user || (user.role !== 'reviewer' && user.role !== 'admin'))
    return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return <Loading />;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/apps" element={<Browse />} />
          <Route path="/apps/:appId" element={<AppDetail />} />
          <Route path="/apps/:appId/install" element={<InstallApp />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/setup/:slug" element={<SetupDistro />} />
          <Route path="/manifesto" element={<Manifesto />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route
            path="/my/apps"
            element={
              <ProtectedRoute>
                <MyApps />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my/apps/new"
            element={
              <ProtectedRoute>
                <NewApp />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my/apps/:appId/verify"
            element={
              <ProtectedRoute>
                <VerifyApp />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my/apps/:appId/submit"
            element={
              <ProtectedRoute>
                <SubmitVersion />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my/submissions"
            element={<Navigate to="/my/apps" replace />}
          />
          <Route
            path="/my/submissions/:id"
            element={
              <ProtectedRoute>
                <SubmissionDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/apps"
            element={
              <AdminRoute>
                <AdminApps />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <Users />
              </AdminRoute>
            }
          />
          <Route
            path="/review"
            element={
              <ReviewerRoute>
                <ReviewQueue />
              </ReviewerRoute>
            }
          />
          <Route
            path="/review/:id"
            element={
              <ReviewerRoute>
                <SubmissionDetail reviewMode />
              </ReviewerRoute>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
