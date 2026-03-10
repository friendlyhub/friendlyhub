import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listApps } from '../api/client';
import AppCard from '../components/AppCard';

export default function Browse() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  const { data: apps, isLoading } = useQuery({
    queryKey: ['apps', query],
    queryFn: () => listApps(query || undefined, 100),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(search);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Browse Apps</h1>

      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search apps..."
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <button
            type="submit"
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700"
          >
            Search
          </button>
        </div>
      </form>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>
      ) : apps && apps.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {apps.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            {query ? `No apps found for "${query}"` : 'No apps published yet'}
          </p>
        </div>
      )}
    </div>
  );
}
