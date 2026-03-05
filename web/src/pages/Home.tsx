import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listApps } from '../api/client';
import AppCard from '../components/AppCard';

export default function Home() {
  const { data: apps } = useQuery({
    queryKey: ['apps', 'home'],
    queryFn: () => listApps(undefined, 12),
  });

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-2xl">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Apps that respect developers
            </h1>
            <p className="mt-4 text-lg text-emerald-100">
              FriendlyHub is a Flatpak repository that's actually friendly. Clear review
              criteria, automated builds, no gatekeeping on non-safety concerns.
            </p>
            <div className="mt-8 flex gap-4">
              <Link
                to="/apps"
                className="bg-white text-emerald-700 px-6 py-3 rounded-lg font-semibold hover:bg-emerald-50 transition-colors"
              >
                Browse Apps
              </Link>
              <a
                href="https://github.com/friendlyhub"
                target="_blank"
                rel="noopener noreferrer"
                className="border border-emerald-300 text-white px-6 py-3 rounded-lg font-semibold hover:bg-emerald-500/20 transition-colors"
              >
                Publish Your App
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Setup instructions */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-gray-900 rounded-2xl p-8 text-white">
          <h2 className="text-lg font-semibold mb-3">Add FriendlyHub to your system</h2>
          <code className="block bg-gray-800 rounded-lg p-4 text-sm font-mono text-emerald-400">
            flatpak remote-add --if-not-exists friendlyhub
            https://friendlyhub.org/repo/friendlyhub.flatpakrepo
          </code>
        </div>
      </section>

      {/* Featured / Recent Apps */}
      {apps && apps.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Apps</h2>
            <Link
              to="/apps"
              className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
            >
              View all &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        </section>
      )}

      {/* Value props */}
      <section className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">No Gatekeeping</h3>
              <p className="mt-2 text-gray-600">
                We review for safety and accuracy, not icon quality or naming
                conventions. Your app, your choices.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Automated Builds</h3>
              <p className="mt-2 text-gray-600">
                Submit your Flatpak manifest, and GitHub Actions handles the rest.
                Fast, reliable, transparent build logs.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Fully Compatible</h3>
              <p className="mt-2 text-gray-600">
                Works with the standard Flatpak CLI, GNOME Software, and KDE
                Discover. Run alongside Flathub with zero conflicts.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
