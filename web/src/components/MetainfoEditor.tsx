import { useRef, useCallback, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { Upload } from 'lucide-react';

interface MetainfoEditorProps {
  value: string;
  onChange: (text: string) => void;
  parseError: string | null;
  onLoadFile: (text: string) => void;
}

const XML_URI = 'file:///metainfo.xml';

export default function MetainfoEditor({
  value,
  onChange,
  parseError,
  onLoadFile,
}: MetainfoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const suppressSyncRef = useRef(false);
  onChangeRef.current = onChange;

  // Create editor on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const uri = monaco.Uri.parse(XML_URI);
    const model = monaco.editor.createModel(value, 'xml', uri);

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
    });

    ed.onDidChangeModelContent(() => {
      if (suppressSyncRef.current) return;
      onChangeRef.current(ed.getValue());
    });

    editorRef.current = ed;

    return () => {
      ed.dispose();
      model.dispose();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes into the editor
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

  // File upload handler
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      onLoadFile(text);
      requestAnimationFrame(() => {
        editorRef.current?.setValue(text);
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [onLoadFile]);

  return (
    <div className="flex flex-col h-full border-l border-gray-200">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-medium text-gray-500">XML</span>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,.metainfo.xml"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Load
          </button>
        </div>
      </div>

      {/* Parse error banner */}
      {parseError && (
        <div className="px-3 py-1.5 bg-red-50 border-b border-red-200 text-xs text-red-600 truncate">
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
