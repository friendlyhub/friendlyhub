import { useRef, useCallback, useEffect, useState } from 'react';
import * as monaco from 'monaco-editor';
import { configureMonacoYaml } from 'monaco-yaml';

import YAML from 'yaml';
import { Upload } from 'lucide-react';
import flatpakSchema from '../data/flatpak-manifest.schema.json';

const SCHEMA_URI = 'https://friendlyhub.org/schemas/flatpak-manifest.json';

// Worker routing — exact pattern from the monaco-yaml README's Vite section.
// A local yaml.worker.js wrapper re-exports monaco-yaml/yaml.worker.js
// to work around Vite's module resolution in web workers.
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import YamlWorker from '../yaml.worker.js?worker';

window.MonacoEnvironment = {
  getWorker(_moduleId: string, label: string) {
    switch (label) {
      case 'json':
        return new JsonWorker();
      case 'yaml':
        return new YamlWorker();
      default:
        return new EditorWorker();
    }
  },
};

let configured = false;
if (!configured) {
  configured = true;
  // JSON schema validation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (monaco.languages.json as any).jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: false,
    schemas: [
      {
        uri: SCHEMA_URI,
        fileMatch: ['*.json'],
        schema: flatpakSchema as Record<string, unknown>,
      },
    ],
  });

  // YAML schema validation
  try {
    configureMonacoYaml(monaco, {
      enableSchemaRequest: false,
      validate: true,
      format: true,
      schemas: [
        {
          uri: SCHEMA_URI,
          fileMatch: ['*.yaml'],
          schema: flatpakSchema as Record<string, unknown>,
        },
      ],
    });
  } catch (err) {
    console.error('Failed to configure monaco yaml:', err);
  }
}

export type EditorFormat = 'yaml' | 'json';

interface ManifestEditorProps {
  value: string;
  format: EditorFormat;
  onChange: (text: string, format: EditorFormat) => void;
  onFormatChange: (format: EditorFormat) => void;
  parseError: string | null;
  onLoadFile: (text: string, detectedFormat: EditorFormat) => void;
}

function detectFormat(text: string): EditorFormat {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  return 'yaml';
}

const YAML_URI = 'file:///manifest.yaml';
const JSON_URI = 'file:///manifest.json';

export default function ManifestEditor({
  value,
  format,
  onChange,
  onFormatChange,
  parseError,
  onLoadFile,
}: ManifestEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [converting, setConverting] = useState(false);
  const onChangeRef = useRef(onChange);
  const formatRef = useRef(format);
  const suppressSyncRef = useRef(false);
  onChangeRef.current = onChange;
  formatRef.current = format;

  // Create editor on mount, destroy on unmount
  useEffect(() => {
    if (!containerRef.current) return;

    const uri = monaco.Uri.parse(YAML_URI);
    const model = monaco.editor.createModel(value, 'yaml', uri);

    const ed = monaco.editor.create(containerRef.current, {
      model,
      theme: 'vs-light',
      minimap: { enabled: false },
      fontSize: 13,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      tabSize: 2,
      automaticLayout: true,
      links: false,
      suggest: {
        showKeywords: true,
        showSnippets: true,
      },
      quickSuggestions: {
        strings: true,
        other: true,
        comments: false,
      },
    });

    ed.onDidChangeModelContent(() => {
      if (suppressSyncRef.current) return;
      const val = ed.getValue();
      onChangeRef.current(val, formatRef.current);
    });

    editorRef.current = ed;

    return () => {
      ed.dispose();
      model.dispose();
      editorRef.current = null;
    };
    // Only run on mount/unmount -- value is initial only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (from form) into the editor
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const currentValue = ed.getValue();
    if (value !== currentValue) {
      suppressSyncRef.current = true;
      ed.setValue(value);
      suppressSyncRef.current = false;
    }
  }, [value]);

  // When format changes, swap the model URI so the correct schema fileMatch applies
  useEffect(() => {
    if (!editorRef.current) return;
    const ed = editorRef.current;

    const uri = monaco.Uri.parse(format === 'json' ? JSON_URI : YAML_URI);
    const lang = format === 'json' ? 'json' : 'yaml';
    const currentModel = ed.getModel();

    if (currentModel && currentModel.uri.toString() === uri.toString()) return;

    const content = currentModel?.getValue() || '';
    const newModel = monaco.editor.createModel(content, lang, uri);
    ed.setModel(newModel);
    if (currentModel) currentModel.dispose();
  }, [format]);

  // Convert between formats
  const handleFormatChange = useCallback((newFormat: EditorFormat) => {
    if (newFormat === format) return;
    setConverting(true);

    try {
      const currentValue = editorRef.current?.getValue() || value;
      let obj: unknown;
      if (format === 'json') {
        obj = JSON.parse(currentValue);
      } else {
        obj = YAML.parse(currentValue);
      }

      let newText: string;
      if (newFormat === 'json') {
        newText = JSON.stringify(obj, null, 2);
      } else {
        newText = YAML.stringify(obj, { indent: 2, lineWidth: 0 });
      }

      onFormatChange(newFormat);
      onChange(newText, newFormat);

      // Update editor content after model swap
      requestAnimationFrame(() => {
        editorRef.current?.setValue(newText);
      });
    } catch {
      onFormatChange(newFormat);
    }

    setConverting(false);
  }, [format, value, onChange, onFormatChange]);

  // File upload handler
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const detected = detectFormat(text);
      onLoadFile(text, detected);

      // Update editor content
      requestAnimationFrame(() => {
        editorRef.current?.setValue(text);
      });
    };
    reader.readAsText(file);

    e.target.value = '';
  }, [onLoadFile]);

  return (
    <div className="flex flex-col h-full border-l border-gray-200 dark:border-gray-800">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleFormatChange('yaml')}
            disabled={converting}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              format === 'yaml'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            YAML
          </button>
          <button
            type="button"
            onClick={() => handleFormatChange('json')}
            disabled={converting}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              format === 'json'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            JSON
          </button>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.yaml,.yml"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Load
          </button>
        </div>
      </div>

      {/* Parse error banner */}
      {parseError && (
        <div className="px-3 py-1.5 bg-red-50 dark:bg-red-950 border-b border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 truncate">
          {parseError}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 min-h-[500px] lg:min-h-0 relative">
        <div className="absolute inset-0" ref={containerRef} />
      </div>
    </div>
  );
}
