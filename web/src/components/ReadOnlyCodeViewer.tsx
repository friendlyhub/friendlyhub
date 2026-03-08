import { useRef, useEffect, useState, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Quote } from 'lucide-react';

// Reuse the same worker routing as ManifestEditor.
// Setting MonacoEnvironment is idempotent -- safe if already set.
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';

if (!window.MonacoEnvironment) {
  window.MonacoEnvironment = {
    getWorker(_moduleId: string, label: string) {
      if (label === 'json') return new JsonWorker();
      return new EditorWorker();
    },
  };
}

let idCounter = 0;

interface ReadOnlyCodeViewerProps {
  value: string;
  language: string;
  maxHeight?: number;
  onQuote?: (text: string, startLine: number, endLine: number) => void;
}

export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json': return 'json';
    case 'yaml': case 'yml': return 'yaml';
    case 'xml': return 'xml';
    case 'sh': case 'bash': return 'shell';
    case 'py': return 'python';
    case 'rs': return 'rust';
    case 'toml': return 'toml';
    case 'js': return 'javascript';
    case 'ts': return 'typescript';
    default: return 'plaintext';
  }
}

export default function ReadOnlyCodeViewer({
  value,
  language,
  maxHeight = 600,
  onQuote,
}: ReadOnlyCodeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const idRef = useRef(++idCounter);
  const [hasSelection, setHasSelection] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const uri = monaco.Uri.parse(`file:///review-${idRef.current}.${language === 'json' ? 'json' : language === 'xml' ? 'xml' : 'txt'}`);
    const model = monaco.editor.createModel(value, language, uri);

    const ed = monaco.editor.create(containerRef.current, {
      model,
      theme: 'vs-light',
      readOnly: true,
      minimap: { enabled: false },
      fontSize: 13,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      tabSize: 2,
      automaticLayout: true,
      links: false,
      domReadOnly: false,
      renderLineHighlight: 'none',
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      scrollbar: {
        alwaysConsumeMouseWheel: false,
      },
    });

    editorRef.current = ed;

    if (onQuote) {
      ed.onDidChangeCursorSelection((e) => {
        const sel = e.selection;
        setHasSelection(
          sel.startLineNumber !== sel.endLineNumber ||
          sel.startColumn !== sel.endColumn,
        );
      });
    }

    return () => {
      ed.dispose();
      model.dispose();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync value changes
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const currentValue = ed.getValue();
    if (value !== currentValue) {
      ed.setValue(value);
    }
  }, [value]);

  const handleQuote = useCallback(() => {
    const ed = editorRef.current;
    if (!ed || !onQuote) return;
    const sel = ed.getSelection();
    if (!sel) return;
    const model = ed.getModel();
    if (!model) return;
    const text = model.getValueInRange(sel);
    if (!text.trim()) return;
    onQuote(text, sel.startLineNumber, sel.endLineNumber);
  }, [onQuote]);

  // Compute height based on line count
  const lineCount = value.split('\n').length;
  const lineHeight = 20;
  const padding = 16;
  const computedHeight = Math.min(maxHeight, lineCount * lineHeight + padding);

  return (
    <div
      className="relative"
      style={{ height: computedHeight }}
    >
      <div className="absolute inset-0" ref={containerRef} />
      {onQuote && hasSelection && (
        <button
          type="button"
          onClick={handleQuote}
          className="absolute top-2 right-4 z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md shadow-sm hover:bg-emerald-700 transition-colors"
        >
          <Quote className="w-3.5 h-3.5" />
          Quote Selection
        </button>
      )}
    </div>
  );
}
