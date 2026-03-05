import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import yaml from 'js-yaml';
import { getApp, submitApp } from '../api/client';

function parseManifest(text: string): unknown {
  // Try JSON first, then YAML
  try {
    return JSON.parse(text);
  } catch {
    // Not JSON, try YAML
  }
  try {
    return yaml.load(text);
  } catch {
    // Neither worked
  }
  throw new Error('Invalid manifest. Must be valid JSON or YAML.');
}

const EXAMPLE_MANIFEST = `app-id: org.example.MyApp
runtime: org.freedesktop.Platform
runtime-version: "24.08"
sdk: org.freedesktop.Sdk
command: myapp
modules:
  - name: myapp
    buildsystem: simple
    build-commands:
      - install -D myapp /app/bin/myapp
    sources:
      - type: archive
        url: https://example.org/myapp-1.0.tar.gz
        sha256: "..."
finish-args:
  - --share=ipc
  - --socket=fallback-x11
  - --socket=wayland`;

export default function SubmitVersion() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const [version, setVersion] = useState('');
  const [manifestText, setManifestText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [sourceFiles, setSourceFiles] = useState<Record<string, string>>({});

  const { data: app, isLoading: appLoading } = useQuery({
    queryKey: ['app', appId],
    queryFn: () => getApp(appId!),
    enabled: !!appId,
  });

  const mutation = useMutation({
    mutationFn: () => {
      setParseError(null);
      const manifest = parseManifest(manifestText);
      return submitApp(appId!, version, manifest, sourceFiles);
    },
    onSuccess: (result) => {
      navigate(`/my/submissions/${result.id}`);
    },
    onError: (err: Error) => {
      if (err.message.includes('manifest') || err.message.includes('JSON') || err.message.includes('YAML')) {
        setParseError(err.message);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  if (appLoading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  if (!app) {
    return (
      <div className="text-center py-12 text-red-500">App not found</div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link
          to={`/apps/${app.app_id}`}
          className="text-sm text-emerald-600 hover:text-emerald-700"
        >
          &larr; Back to {app.name}
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        Submit New Version
      </h1>
      <p className="text-gray-500 mb-8">
        Submit a Flatpak manifest for{' '}
        <span className="font-mono font-medium text-gray-700">
          {app.app_id}
        </span>{' '}
        to trigger a build.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Version <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.0.0"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Flatpak Manifest (JSON or YAML) <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setManifestText(
                  EXAMPLE_MANIFEST.replace(
                    'org.example.MyApp',
                    app.app_id,
                  ).replace('myapp', app.name.toLowerCase().replace(/\s+/g, '')),
                );
                setParseError(null);
              }}
              className="text-xs text-emerald-600 hover:text-emerald-700"
            >
              Load example
            </button>
          </div>
          <textarea
            required
            value={manifestText}
            onChange={(e) => {
              setManifestText(e.target.value);
              setParseError(null);
            }}
            rows={20}
            placeholder="Paste your Flatpak manifest here (JSON or YAML)..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono leading-relaxed"
          />
          {parseError && (
            <p className="text-sm text-red-600 mt-1">{parseError}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Companion Source Files{' '}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <p className="text-xs text-gray-500 mb-2">
            If your manifest references external source files (e.g.{' '}
            <span className="font-mono">cargo-sources.json</span>,{' '}
            <span className="font-mono">node-sources.json</span>), add them
            here.
          </p>
          <input
            type="file"
            multiple
            accept=".json"
            onChange={(e) => {
              const files = e.target.files;
              if (!files) return;
              Array.from(files).forEach((file) => {
                const reader = new FileReader();
                reader.onload = () => {
                  setSourceFiles((prev) => ({
                    ...prev,
                    [file.name]: reader.result as string,
                  }));
                };
                reader.readAsText(file);
              });
            }}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
          />
          {Object.keys(sourceFiles).length > 0 && (
            <div className="mt-2 space-y-1">
              {Object.keys(sourceFiles).map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-between bg-gray-50 rounded px-3 py-1.5 text-sm"
                >
                  <span className="font-mono text-gray-700">{name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSourceFiles((prev) => {
                        const next = { ...prev };
                        delete next[name];
                        return next;
                      })
                    }
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {mutation.isError && !parseError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {(mutation.error as Error).message}
          </div>
        )}

        {mutation.isSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
            Build submitted. Redirecting...
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Submitting...' : 'Submit Build'}
        </button>
      </form>
    </div>
  );
}
