import { useState, useEffect } from 'react';
import type { SourceFileInfo } from '../api/client';
import ReadOnlyCodeViewer, { detectLanguage } from './ReadOnlyCodeViewer';

interface Props {
  files: SourceFileInfo[];
  onQuote?: (filename: string, text: string, startLine: number, endLine: number) => void;
}

export default function SourceFileTabs({ files, onQuote }: Props) {
  const [activeTab, setActiveTab] = useState<string>(files[0]?.name ?? '');
  const [contents, setContents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!activeTab || contents[activeTab] || loading[activeTab]) return;

    const file = files.find((f) => f.name === activeTab);
    if (!file) return;

    setLoading((prev) => ({ ...prev, [activeTab]: true }));
    fetch(file.download_url)
      .then((res) => res.text())
      .then((text) => {
        setContents((prev) => ({ ...prev, [activeTab]: text }));
        setLoading((prev) => ({ ...prev, [activeTab]: false }));
      })
      .catch(() => {
        setContents((prev) => ({ ...prev, [activeTab]: '// Failed to load file' }));
        setLoading((prev) => ({ ...prev, [activeTab]: false }));
      });
  }, [activeTab, files, contents, loading]);

  return (
    <div>
      <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50">
        {files.map((file) => (
          <button
            key={file.name}
            type="button"
            onClick={() => setActiveTab(file.name)}
            className={`px-4 py-2 text-xs font-mono whitespace-nowrap border-b-2 transition-colors ${
              activeTab === file.name
                ? 'border-emerald-500 text-emerald-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {file.name}
          </button>
        ))}
      </div>
      <div>
        {loading[activeTab] ? (
          <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
        ) : contents[activeTab] ? (
          <ReadOnlyCodeViewer
            value={contents[activeTab]}
            language={detectLanguage(activeTab)}
            onQuote={onQuote ? (text, startLine, endLine) => onQuote(activeTab, text, startLine, endLine) : undefined}
          />
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            Select a file to view its contents.
          </div>
        )}
      </div>
    </div>
  );
}
