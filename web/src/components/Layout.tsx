import { useState, useRef, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Package, ClipboardCheck, Users, Menu, X } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import ThemeToggle from './ThemeToggle';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isDashboardRoute = location.pathname.startsWith('/my/') || location.pathname.startsWith('/review') || location.pathname.startsWith('/admin');

  const sidebarLinks = [
    { to: '/my/apps', label: 'Apps', icon: Package },
    ...((user?.role === 'reviewer' || user?.role === 'admin')
      ? [{ to: '/review', label: 'Review Queue', icon: ClipboardCheck }]
      : []),
    ...(user?.role === 'admin'
      ? [{ to: '/admin/users', label: 'Users', icon: Users }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <nav className="h-16 flex items-center justify-between mx-2 sm:mx-4 md:mx-6 lg:mx-8 xl:mx-12 2xl:mx-auto 2xl:max-w-351.25">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 text-xl font-bold text-emerald-600">
              <img src="/images/friendlyhub_logo.svg" alt="" className="h-7 w-7" />
              FriendlyHub
            </Link>
            <Link
              to="/apps"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 text-sm font-medium"
            >
              Browse
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            {user ? (
              <>
                {isDashboardRoute && (
                  <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="lg:hidden text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                  >
                    {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </button>
                )}
                <Link
                  to="/my/apps"
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 text-sm font-medium"
                >
                  Dashboard
                </Link>
                <div className="relative ml-2" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">{user.display_name}</span>
                    {user.avatar_url && (
                      <img
                        src={user.avatar_url}
                        alt={user.display_name}
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                      <button
                        onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <a
                href="/api/v1/auth/github"
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 text-sm font-medium"
              >
                Login
              </a>
            )}
          </div>
        </nav>
      </header>

      {user && isDashboardRoute ? (
        <div className="flex flex-1">
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/30 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <aside
            className={`fixed lg:static inset-y-0 left-0 z-50 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 pt-4 transform transition-all lg:transform-none group/sidebar ${
              sidebarOpen
                ? 'translate-x-0 w-56'
                : '-translate-x-full lg:translate-x-0 lg:w-14 lg:hover:w-56'
            }`}
          >
            <nav className="space-y-1 px-2">
              {sidebarLinks.map(({ to, label, icon: Icon }) => {
                const isActive = location.pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setSidebarOpen(false)}
                    title={label}
                    className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`} />
                    <span className={`whitespace-nowrap overflow-hidden transition-opacity ${
                      sidebarOpen ? 'opacity-100' : 'opacity-0 lg:group-hover/sidebar:opacity-100'
                    }`}>
                      {label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </aside>

          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      ) : (
        <main className="flex-1">
          <Outlet />
        </main>
      )}

      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-8 mt-auto">
        <div className="mx-2 sm:mx-4 md:mx-6 lg:mx-8 xl:mx-12 2xl:mx-auto 2xl:max-w-351.25">
          <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
            <p>FriendlyHub — A friendly Flatpak repository</p>
            <div className="flex gap-6">
              <a
                href="https://github.com/friendlyhub"
                className="hover:text-gray-700 dark:hover:text-gray-300"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              <Link to="/apps" className="hover:text-gray-700 dark:hover:text-gray-300">
                Browse Apps
              </Link>
              <Link to="/privacy" className="hover:text-gray-700 dark:hover:text-gray-300">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
