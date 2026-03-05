import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-bold text-emerald-600">
              FriendlyHub
            </Link>
            <Link
              to="/apps"
              className="text-gray-600 hover:text-gray-900 text-sm font-medium"
            >
              Browse
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  to="/my/apps"
                  className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                >
                  My Apps
                </Link>
                <Link
                  to="/my/submissions"
                  className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                >
                  Submissions
                </Link>
                {(user.role === 'reviewer' || user.role === 'admin') && (
                  <Link
                    to="/review"
                    className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                  >
                    Review
                  </Link>
                )}
                <div className="flex items-center gap-2 ml-2">
                  {user.avatar_url && (
                    <img
                      src={user.avatar_url}
                      alt={user.display_name}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span className="text-sm text-gray-700">{user.display_name}</span>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-gray-500 hover:text-gray-700 ml-2"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <a
                href="/api/v1/auth/github"
                className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                </svg>
                Sign in with GitHub
              </a>
            )}
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <p>FriendlyHub — A friendly Flatpak repository</p>
            <div className="flex gap-6">
              <a
                href="https://github.com/friendlyhub"
                className="hover:text-gray-700"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              <Link to="/apps" className="hover:text-gray-700">
                Browse Apps
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
