import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createApp } from '../api/client';

const PREDEFINED_CATEGORIES = [
  'Audio & Video',
  'Communication',
  'Development',
  'Education',
  'Games',
  'Graphics',
  'Internet',
  'Office',
  'Science',
  'System',
  'Utilities',
  'Accessibility',
  'Finance',
  'Music',
  'Photography',
  'Productivity',
  'Security',
];

export default function NewApp() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    app_id: '',
    name: '',
    summary: '',
    description: '',
    homepage_url: '',
    source_url: '',
    license: '',
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [catInput, setCatInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createApp({
        ...form,
        categories: categories.length > 0 ? categories : undefined,
      }),
    onSuccess: (app) => navigate(`/apps/${app.app_id}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const filteredSuggestions = PREDEFINED_CATEGORIES.filter(
    (cat) =>
      !categories.includes(cat) &&
      cat.toLowerCase().includes(catInput.toLowerCase()),
  );

  const addCategory = (cat: string) => {
    if (!categories.includes(cat)) {
      setCategories((prev) => [...prev, cat]);
    }
    setCatInput('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const removeCategory = (cat: string) => {
    setCategories((prev) => prev.filter((c) => c !== cat));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Register New App
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            App ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.app_id}
            onChange={(e) => update('app_id', e.target.value)}
            placeholder="org.example.MyApp"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Reverse-DNS format, at least 3 components
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="My App"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Summary <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.summary}
            onChange={(e) => update('summary', e.target.value)}
            placeholder="A brief description of your app"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={4}
            placeholder="Full description of your app..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Categories / Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Categories
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {categories.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-medium"
              >
                {cat}
                <button
                  type="button"
                  onClick={() => removeCategory(cat)}
                  className="text-emerald-500 hover:text-emerald-800"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={catInput}
              onChange={(e) => {
                setCatInput(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && catInput.trim()) {
                  e.preventDefault();
                  addCategory(catInput.trim());
                }
              }}
              placeholder="Type to search or add categories..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredSuggestions.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addCategory(cat)}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 text-gray-700"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Select from suggestions or type a custom category and press Enter
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Homepage URL
            </label>
            <input
              type="url"
              value={form.homepage_url}
              onChange={(e) => update('homepage_url', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source Code URL
            </label>
            <input
              type="url"
              value={form.source_url}
              onChange={(e) => update('source_url', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            License
          </label>
          <input
            type="text"
            value={form.license}
            onChange={(e) => update('license', e.target.value)}
            placeholder="MIT, GPL-3.0, etc."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {mutation.isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {(mutation.error as Error).message}
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Creating...' : 'Register App'}
        </button>
      </form>
    </div>
  );
}
