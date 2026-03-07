import { useState, useCallback, useRef, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FileCode, FormInput, AlertTriangle } from 'lucide-react';
import YAML from 'yaml';
import { getApp, submitApp } from '../api/client';
import ManifestForm from '../components/ManifestForm';
import ManifestEditor, { type EditorFormat } from '../components/ManifestEditor';
import { createBlankManifest, getManifestAppId, normalizeManifest, validateRequired, type Manifest } from '../utils/manifest';

function exampleMetainfo(appId: string, name: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>${appId}</id>
  <metadata_license>CC0-1.0</metadata_license>
  <project_license>GPL-3.0-or-later</project_license>
  <name>${name}</name>
  <summary>A short summary of the app</summary>
  <description>
    <p>A longer description of what the app does.</p>
  </description>
  <developer id="com.example">
    <name>Your Name</name>
  </developer>
  <screenshots>
    <screenshot type="default">
      <image>https://example.com/screenshot.png</image>
      <caption>Main window</caption>
    </screenshot>
  </screenshots>
  <url type="homepage">https://example.com</url>
  <url type="bugtracker">https://github.com/example/app/issues</url>
  <url type="vcs-browser">https://github.com/example/app</url>
  <content_rating type="oars-1.1" />
  <releases>
    <release version="1.0.0" date="2026-01-01">
      <description>
        <p>Initial release.</p>
      </description>
    </release>
  </releases>
</component>`;
}

function serializeManifest(m: Manifest, format: EditorFormat): string {
  if (format === 'json') {
    return JSON.stringify(m, null, 2);
  }
  return YAML.stringify(m, { indent: 2, lineWidth: 0 });
}

// Replace deprecated app-id with id in-place (text-level to preserve formatting)
function normalizeAppIdInText(text: string): string {
  // YAML: `app-id:` at start of line
  // JSON: `"app-id"`
  return text
    .replace(/^(\s*)app-id(\s*:)/m, '$1id$2')
    .replace(/"app-id"/g, '"id"');
}

function parseManifestText(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch { /* not JSON */ }
  try {
    const result = YAML.parse(trimmed);
    if (result && typeof result === 'object') return result as Record<string, unknown>;
  } catch { /* not YAML */ }
  return null;
}

export default function SubmitVersion() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();

  // Manifest state
  const [manifest, setManifest] = useState<Manifest>(() => createBlankManifest(appId || ''));
  const [editorText, setEditorText] = useState<string>(() =>
    serializeManifest(createBlankManifest(appId || ''), 'yaml')
  );
  const [editorFormat, setEditorFormat] = useState<EditorFormat>('yaml');
  const [parseError, setParseError] = useState<string | null>(null);

  // Track which side is driving updates to prevent loops
  const updateSourceRef = useRef<'form' | 'editor' | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Submission fields (kept for now)
  const [version, setVersion] = useState('');
  const [metainfoText, setMetainfoText] = useState('');
  const [sourceFiles, setSourceFiles] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Mobile view toggle
  const [mobileView, setMobileView] = useState<'form' | 'editor'>('form');

  const { data: app, isLoading: appLoading } = useQuery({
    queryKey: ['app', appId],
    queryFn: () => getApp(appId!),
    enabled: !!appId,
  });

  // Form -> Editor sync
  const handleFormChange = useCallback((newManifest: Manifest) => {
    updateSourceRef.current = 'form';
    setManifest(newManifest);
    setEditorText(serializeManifest(newManifest, editorFormat));
    setParseError(null);
  }, [editorFormat]);

  // Editor -> Form sync (debounced)
  const handleEditorChange = useCallback((text: string, _format: EditorFormat) => {
    setEditorText(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      updateSourceRef.current = 'editor';
      const normalized = normalizeAppIdInText(text);
      if (normalized !== text) {
        setEditorText(normalized);
      }
      const parsed = parseManifestText(normalized);
      if (parsed) {
        setManifest(parsed as Manifest);
        setParseError(null);
      } else if (normalized.trim()) {
        setParseError('Invalid manifest. Must be valid JSON or YAML.');
      }
    }, 400);
  }, []);

  // Format change (JSON <-> YAML)
  const handleFormatChange = useCallback((newFormat: EditorFormat) => {
    setEditorFormat(newFormat);
  }, []);

  // File load
  const handleLoadFile = useCallback((text: string, detectedFormat: EditorFormat) => {
    const normalized = normalizeAppIdInText(text);
    setEditorFormat(detectedFormat);
    setEditorText(normalized);
    const parsed = parseManifestText(normalized);
    if (parsed) {
      setManifest(parsed as Manifest);
      setParseError(null);
    } else {
      setParseError('Could not parse the uploaded file.');
    }
  }, []);

  // Validation
  const missingFields = useMemo(() => validateRequired(manifest), [manifest]);
  const manifestAppId = getManifestAppId(manifest);
  const appIdMismatch = manifestAppId !== '' && manifestAppId !== appId;

  // Submission
  const mutation = useMutation({
    mutationFn: () => {
      setSubmitError(null);
      return submitApp(appId!, version, normalizeManifest(manifest), metainfoText, sourceFiles);
    },
    onSuccess: (result) => {
      navigate(`/my/submissions/${result.id}`);
    },
    onError: (err: Error) => {
      setSubmitError(err.message);
    },
  });

  const canSubmit = missingFields.length === 0 && !appIdMismatch && !parseError && version.trim() && metainfoText.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    mutation.mutate();
  };

  if (appLoading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  if (!app) {
    return <div className="text-center py-12 text-red-500">App not found</div>;
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <Link
              to={`/apps/${app.app_id}`}
              className="text-xs text-emerald-600 hover:text-emerald-700"
            >
              &larr; {app.name}
            </Link>
            <h1 className="text-lg font-bold text-gray-900">
              Submit New Version
              <span className="text-sm font-normal text-gray-500 ml-2 font-mono">{app.app_id}</span>
            </h1>
          </div>

          {/* Mobile view toggle */}
          <div className="flex lg:hidden items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setMobileView('form')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                mobileView === 'form' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              <FormInput className="w-3.5 h-3.5" /> Form
            </button>
            <button
              type="button"
              onClick={() => setMobileView('editor')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                mobileView === 'editor' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" /> Manifest
            </button>
          </div>
        </div>
      </div>

      {/* Manifest card */}
      <div className="mx-4 sm:mx-6 mt-4 border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <FileCode className="w-4 h-4" />
            Flatpak Manifest
          </h2>
        </div>

        <div className="flex relative">
          {/* Form pane (left) */}
          <div
            className={`lg:block ${mobileView === 'form' ? 'w-full' : 'hidden'} bg-white overflow-y-auto`}
            style={{ width: 'var(--form-width, 50%)' }}
          >
            <ManifestForm
              manifest={manifest}
              onChange={handleFormChange}
              lockedAppId={appId || ''}
            />
          </div>

          {/* Drag handle */}
          <div
            className="hidden lg:flex w-1.5 cursor-col-resize items-center justify-center bg-gray-100 border-x border-gray-200 hover:bg-emerald-100 active:bg-emerald-200 transition-colors select-none shrink-0"
            onMouseDown={(e) => {
              e.preventDefault();
              const container = e.currentTarget.parentElement!;
              const startX = e.clientX;
              const containerRect = container.getBoundingClientRect();
              const startPct = parseFloat(
                getComputedStyle(container).getPropertyValue('--form-width') || '50'
              );
              const startWidth = (startPct / 100) * containerRect.width;

              const onMouseMove = (ev: MouseEvent) => {
                const delta = ev.clientX - startX;
                const newWidth = startWidth + delta;
                const pct = Math.min(80, Math.max(20, (newWidth / containerRect.width) * 100));
                container.style.setProperty('--form-width', `${pct}%`);
              };
              const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
              };
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
              document.addEventListener('mousemove', onMouseMove);
              document.addEventListener('mouseup', onMouseUp);
            }}
          >
            <div className="w-0.5 h-6 rounded-full bg-gray-300" />
          </div>

          {/* Editor pane (right) - sticky so it stays visible while form scrolls */}
          <div
            className={`lg:block ${mobileView === 'editor' ? 'w-full' : 'hidden'} lg:sticky lg:top-0 h-[calc(100vh-8rem)] lg:self-start flex-1 min-w-0`}
          >
            <ManifestEditor
              value={editorText}
              format={editorFormat}
              onChange={handleEditorChange}
              onFormatChange={handleFormatChange}
              parseError={parseError}
              onLoadFile={handleLoadFile}
            />
          </div>
        </div>
      </div>

      {/* Submission area */}
      <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-4">
          {/* Validation status */}
          {missingFields.length > 0 && (
            <div className="text-xs text-amber-600">
              Missing required fields: {missingFields.join(', ')}
            </div>
          )}

          {/* Version + Metainfo (kept for submission) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Companion Source Files{' '}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
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
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
              />
              {Object.keys(sourceFiles).length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.keys(sourceFiles).map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 bg-gray-100 rounded px-2 py-0.5 text-xs font-mono"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() =>
                          setSourceFiles((prev) => {
                            const next = { ...prev };
                            delete next[name];
                            return next;
                          })
                        }
                        className="text-red-400 hover:text-red-600"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Metainfo */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">
                AppStream Metainfo (XML) <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <label className="text-xs text-emerald-600 hover:text-emerald-700 cursor-pointer">
                  Upload
                  <input
                    type="file"
                    accept=".xml,.metainfo.xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setMetainfoText(reader.result as string);
                      reader.readAsText(file);
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setMetainfoText(exampleMetainfo(app.app_id, app.name))}
                  className="text-xs text-emerald-600 hover:text-emerald-700"
                >
                  Example
                </button>
              </div>
            </div>
            <textarea
              required
              value={metainfoText}
              onChange={(e) => setMetainfoText(e.target.value)}
              rows={6}
              placeholder={`Paste AppStream metainfo XML (${app.app_id}.metainfo.xml)...`}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono leading-relaxed"
            />
          </div>

          {/* Errors */}
          {(submitError || mutation.isError) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {submitError || (mutation.error as Error).message}
            </div>
          )}

          {/* Beta notice */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              The manifest editor and validator are in beta and provided on a best-effort basis.
              Your submission passing validation here does not necessarily mean it will pass
              flatpak-builder validation. You will have the opportunity to make changes if
              the submission fails.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={mutation.isPending || !canSubmit}
            className="w-full bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Submitting...' : 'Submit Build'}
          </button>
        </form>
      </div>
    </div>
  );
}
