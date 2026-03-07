import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/auth';
import Layout from './components/Layout';
import Home from './pages/Home';
import Browse from './pages/Browse';
import AppDetail from './pages/AppDetail';
import MyApps from './pages/MyApps';
import NewApp from './pages/NewApp';
import Submissions from './pages/Submissions';
import SubmitVersion from './pages/SubmitVersion';
import SubmissionDetail from './pages/SubmissionDetail';
import ReviewQueue from './pages/ReviewQueue';
import ReviewDetail from './pages/ReviewDetail';
import InstallApp from './pages/InstallApp';
import VerifyApp from './pages/VerifyApp';
import AuthCallback from './pages/AuthCallback';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ReviewerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (!user || (user.role !== 'reviewer' && user.role !== 'admin'))
    return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/apps" element={<Browse />} />
        <Route path="/apps/:appId" element={<AppDetail />} />
        <Route path="/apps/:appId/install" element={<InstallApp />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
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
          element={
            <ProtectedRoute>
              <Submissions />
            </ProtectedRoute>
          }
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
              <ReviewDetail />
            </ReviewerRoute>
          }
        />
      </Route>
    </Routes>
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
