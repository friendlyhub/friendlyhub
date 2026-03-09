import { useState, useRef, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Package, ClipboardCheck, Users, Menu, X } from 'lucide-react';
import { useAuthStore } from '../stores/auth';

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
                {isDashboardRoute && (
                  <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="lg:hidden text-gray-600 hover:text-gray-900"
                  >
                    {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </button>
                )}
                <Link
                  to="/my/apps"
                  className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                >
                  Dashboard
                </Link>
                <div className="relative ml-2" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <span className="text-sm text-gray-700">{user.display_name}</span>
                    {user.avatar_url && (
                      <img
                        src={user.avatar_url}
                        alt={user.display_name}
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <button
                        onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
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
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                Login
              </a>
            )}
          </div>
        </nav>
      </header>

      {user && isDashboardRoute ? (
        <div className="flex flex-1">
          {/* Sidebar overlay for mobile */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/30 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar: icons only, expands on hover */}
          <aside
            className={`fixed lg:static inset-y-0 left-0 z-50 bg-white border-r border-gray-200 pt-4 transform transition-all lg:transform-none group/sidebar ${
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
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-600' : 'text-gray-400'}`} />
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

          {/* Main content */}
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      ) : (
        <main className="flex-1">
          <Outlet />
        </main>
      )}

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
