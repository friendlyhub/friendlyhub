import { Link } from 'react-router-dom';
import distros from '../content/distros';

export default function Setup() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Set up FriendlyHub</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">Choose your distribution for tailored installation instructions.</p>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
        {[...distros].sort((a, b) => a.name.localeCompare(b.name)).map((distro) => (
          <Link
            key={distro.slug}
            to={`/setup/${distro.slug}`}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all group"
          >
            <svg role="img" viewBox="0 0 24 24" className="w-10 h-10" fill={`#${distro.hex}`}>
              <path d={distro.path} />
            </svg>
            <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 text-center">{distro.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
