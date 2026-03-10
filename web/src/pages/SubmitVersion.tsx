import { useState, useCallback, useRef, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FileCode, FileText, FormInput, AlertTriangle, Upload } from 'lucide-react';
import YAML from 'yaml';
import { getApp, submitApp } from '../api/client';
import ManifestForm from '../components/ManifestForm';
import ManifestEditor, { type EditorFormat } from '../components/ManifestEditor';
import MetainfoForm from '../components/MetainfoForm';
import MetainfoEditor from '../components/MetainfoEditor';
import { createBlankManifest, getManifestAppId, normalizeManifest, validateRequired, type Manifest } from '../utils/manifest';
import { createBlankMetainfo, serializeMetainfo, parseMetainfo, validateMetainfo, getLatestVersion, getExternalSourceFiles, type MetainfoData } from '../utils/metainfo';

function serializeManifest(m: Manifest, format: EditorFormat): string {
  if (format === 'json') {
    return JSON.stringify(m, null, 2);
  }
  return YAML.stringify(m, { indent: 2, lineWidth: 0 });
}

// Replace deprecated app-id with id in-place (text-level to preserve formatting)
function normalizeAppIdInText(text: string): string {
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

// Drag handle component (shared between manifest and metainfo cards)
function DragHandle({ cssVar }: { cssVar: string }) {
  return (
    <div
      className="hidden lg:flex w-1.5 cursor-col-resize items-center justify-center bg-gray-100 dark:bg-gray-800 border-x border-gray-200 dark:border-gray-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 active:bg-emerald-200 dark:active:bg-emerald-800 transition-colors select-none shrink-0"
      onMouseDown={(e) => {
        e.preventDefault();
        const container = e.currentTarget.parentElement!;
        const startX = e.clientX;
        const containerRect = container.getBoundingClientRect();
        const startPct = parseFloat(
          getComputedStyle(container).getPropertyValue(cssVar) || '50'
        );
        const startWidth = (startPct / 100) * containerRect.width;

        const onMouseMove = (ev: MouseEvent) => {
          const delta = ev.clientX - startX;
          const newWidth = startWidth + delta;
          const pct = Math.min(80, Math.max(20, (newWidth / containerRect.width) * 100));
          container.style.setProperty(cssVar, `${pct}%`);
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
      <div className="w-0.5 h-6 rounded-full bg-gray-300 dark:bg-gray-600" />
    </div>
  );
}

function SourceFileDropzone({
  filename,
  loaded,
  onLoad,
  onRemove,
}: {
  filename: string;
  loaded: boolean;
  onLoad: (content: string) => void;
  onRemove: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file.name !== filename) {
      alert(`Filename must be "${filename}", got "${file.name}"`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onLoad(reader.result as string);
    reader.readAsText(file);
  };

  if (loaded) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg">
        <span className="text-sm font-mono text-emerald-700 dark:text-emerald-400 flex-1">{filename}</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-red-500 hover:text-red-700"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center gap-1 px-4 py-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
        dragOver ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      <Upload className="w-5 h-5 text-gray-400" />
      <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{filename}</span>
      <span className="text-xs text-red-500 dark:text-red-400">required</span>
    </div>
  );
}

export default function SubmitVersion() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();

  // === Manifest state ===
  const [manifest, setManifest] = useState<Manifest>(() => createBlankManifest(appId || ''));
  const [editorText, setEditorText] = useState<string>(() =>
    serializeManifest(createBlankManifest(appId || ''), 'yaml')
  );
  const [editorFormat, setEditorFormat] = useState<EditorFormat>('yaml');
  const [parseError, setParseError] = useState<string | null>(null);
  const updateSourceRef = useRef<'form' | 'editor' | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // === Metainfo state ===
  const [metainfo, setMetainfo] = useState<MetainfoData>(() => createBlankMetainfo(appId || ''));
  const [metainfoText, setMetainfoText] = useState<string>(() =>
    serializeMetainfo(createBlankMetainfo(appId || ''))
  );
  const [metainfoParseError, setMetainfoParseError] = useState<string | null>(null);
  const metainfoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // === Submission fields ===
  const [sourceFiles, setSourceFiles] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Mobile view toggle
  const [mobileView, setMobileView] = useState<'form' | 'editor'>('form');

  const { data: app, isLoading: appLoading } = useQuery({
    queryKey: ['app', appId],
    queryFn: () => getApp(appId!),
    enabled: !!appId,
  });

  // === Manifest sync ===
  const handleFormChange = useCallback((newManifest: Manifest) => {
    updateSourceRef.current = 'form';
    setManifest(newManifest);
    setEditorText(serializeManifest(newManifest, editorFormat));
    setParseError(null);
  }, [editorFormat]);

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

  const handleFormatChange = useCallback((newFormat: EditorFormat) => {
    setEditorFormat(newFormat);
  }, []);

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

  // === Metainfo sync ===
  const handleMetainfoFormChange = useCallback((newData: MetainfoData) => {
    setMetainfo(newData);
    setMetainfoText(serializeMetainfo(newData));
    setMetainfoParseError(null);
  }, []);

  const handleMetainfoEditorChange = useCallback((text: string) => {
    setMetainfoText(text);
    if (metainfoDebounceRef.current) clearTimeout(metainfoDebounceRef.current);
    metainfoDebounceRef.current = setTimeout(() => {
      const parsed = parseMetainfo(text);
      if (parsed) {
        setMetainfo(parsed);
        setMetainfoParseError(null);
      } else if (text.trim()) {
        setMetainfoParseError('Invalid XML. Must be valid AppStream metainfo.');
      }
    }, 400);
  }, []);

  const handleMetainfoLoadFile = useCallback((text: string) => {
    setMetainfoText(text);
    const parsed = parseMetainfo(text);
    if (parsed) {
      setMetainfo(parsed);
      setMetainfoParseError(null);
    } else {
      setMetainfoParseError('Could not parse the uploaded file.');
    }
  }, []);

  // === Validation ===
  const missingFields = useMemo(() => validateRequired(manifest), [manifest]);
  const manifestAppId = getManifestAppId(manifest);
  const appIdMismatch = manifestAppId !== '' && manifestAppId !== appId;

  const metainfoErrors = useMemo(
    () => validateMetainfo(metainfo, appId || '').filter(m => m.severity === 'error'),
    [metainfo, appId]
  );
  const metainfoIdMismatch = metainfo.id.trim() !== '' && metainfo.id !== appId;

  // === External source files from manifest ===
  const externalSourceFiles = useMemo(() => getExternalSourceFiles(manifest), [manifest]);

  // === Submission ===
  const version = getLatestVersion(metainfo);

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

  // Check all external source files are uploaded
  const missingSourceFiles = externalSourceFiles.filter(f => !sourceFiles[f]);

  const canSubmit =
    missingFields.length === 0 &&
    !appIdMismatch &&
    !parseError &&
    metainfoErrors.length === 0 &&
    !metainfoIdMismatch &&
    !metainfoParseError &&
    version.trim() !== '' &&
    missingSourceFiles.length === 0 &&
    metainfoText.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    mutation.mutate();
  };

  if (appLoading) {
    return <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>;
  }

  if (!app) {
    return <div className="text-center py-12 text-red-500">App not found</div>;
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <Link
              to={`/apps/${app.app_id}`}
              className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            >
              &larr; {app.name}
            </Link>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Submit New Version
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2 font-mono">{app.app_id}</span>
            </h1>
          </div>

          {/* Mobile view toggle */}
          <div className="flex lg:hidden items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setMobileView('form')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                mobileView === 'form' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <FormInput className="w-3.5 h-3.5" /> Form
            </button>
            <button
              type="button"
              onClick={() => setMobileView('editor')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                mobileView === 'editor' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" /> Code
            </button>
          </div>
        </div>
      </div>

      {/* Manifest card */}
      <div className="mx-4 sm:mx-6 mt-4 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <FileCode className="w-4 h-4" />
            Flatpak Manifest
          </h2>
        </div>

        <div className="flex relative">
          {/* Form pane (left) */}
          <div
            className={`lg:block ${mobileView === 'form' ? 'w-full' : 'hidden'} bg-white dark:bg-gray-900 overflow-y-auto`}
            style={{ width: 'var(--form-width, 50%)' }}
          >
            <ManifestForm
              manifest={manifest}
              onChange={handleFormChange}
              lockedAppId={appId || ''}
            />
          </div>

          <DragHandle cssVar="--form-width" />

          {/* Editor pane (right) */}
          <div
            className={`lg:block ${mobileView === 'editor' ? 'w-full' : 'hidden'} flex-1 min-w-0`}
          >
            <div className="lg:sticky lg:top-0 h-[calc(100vh-8rem)]">
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
      </div>

      {/* Metainfo card */}
      <div className="mx-4 sm:mx-6 mt-4 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            AppStream Metainfo
          </h2>
        </div>

        <div className="flex relative">
          {/* Form pane (left) */}
          <div
            className={`lg:block ${mobileView === 'form' ? 'w-full' : 'hidden'} bg-white dark:bg-gray-900 overflow-y-auto`}
            style={{ width: 'var(--metainfo-width, 50%)' }}
          >
            <MetainfoForm
              data={metainfo}
              onChange={handleMetainfoFormChange}
              lockedAppId={appId || ''}
            />
          </div>

          <DragHandle cssVar="--metainfo-width" />

          {/* Editor pane (right) */}
          <div
            className={`lg:block ${mobileView === 'editor' ? 'w-full' : 'hidden'} flex-1 min-w-0`}
          >
            <div className="lg:sticky lg:top-0 h-[calc(100vh-8rem)]">
              <MetainfoEditor
                value={metainfoText}
                onChange={handleMetainfoEditorChange}
                parseError={metainfoParseError}
                onLoadFile={handleMetainfoLoadFile}
              />
            </div>
          </div>
        </div>
      </div>

      {/* External source files */}
      {externalSourceFiles.length > 0 && (
        <div className="mx-4 sm:mx-6 mt-4 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Upload className="w-4 h-4" />
              Source Files
              <span className="text-xs font-normal text-gray-400 ml-1">
                referenced in manifest
              </span>
            </h2>
          </div>
          <div className="p-4 space-y-3">
            {externalSourceFiles.map((filename) => (
              <SourceFileDropzone
                key={filename}
                filename={filename}
                loaded={!!sourceFiles[filename]}
                onLoad={(content) => setSourceFiles((prev) => ({ ...prev, [filename]: content }))}
                onRemove={() => setSourceFiles((prev) => {
                  const next = { ...prev };
                  delete next[filename];
                  return next;
                })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Submission area */}
      <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-4 mt-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-4">
          {/* Errors */}
          {(submitError || mutation.isError) && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
              {submitError || (mutation.error as Error).message}
            </div>
          )}

          {/* Beta notice */}
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              The Flatpak manifest &amp; AppStream metainfo editor and validator are in beta
              and provided on a best-effort basis. Your submission may still fail when validated
              during build with flatpak-builder and appstreamcli. You can make changes later
              if this submission fails.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={mutation.isPending || !canSubmit}
            className="w-full bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Submitting...' : version ? `Submit v${version}` : 'Submit Build'}
          </button>
        </form>
      </div>
    </div>
  );
}
