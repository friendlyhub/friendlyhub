import { FileCode, FileText, FolderOpen } from 'lucide-react';
import type { SourceFileInfo } from '../api/client';
import type { Submission } from '../types';
import CollapsibleCard from './CollapsibleCard';
import ReadOnlyCodeViewer from './ReadOnlyCodeViewer';
import SourceFileTabs from './SourceFileTabs';

interface Props {
  submission: Submission;
  sourceFiles?: SourceFileInfo[];
  onQuote?: (filename: string, text: string, startLine: number, endLine: number) => void;
}

export default function SubmissionCards({ submission: sub, sourceFiles, onQuote }: Props) {
  return (
    <>
      <CollapsibleCard
        title="Manifest"
        icon={<FileCode className="w-5 h-5 text-gray-400" />}
      >
        <ReadOnlyCodeViewer
          value={JSON.stringify(sub.manifest, null, 2)}
          language="json"
          onQuote={onQuote ? (text, startLine, endLine) => onQuote('manifest.json', text, startLine, endLine) : undefined}
        />
      </CollapsibleCard>

      {sub.metainfo && (
        <CollapsibleCard
          title="Metainfo"
          icon={<FileText className="w-5 h-5 text-gray-400" />}
        >
          <ReadOnlyCodeViewer
            value={sub.metainfo}
            language="xml"
            onQuote={onQuote ? (text, startLine, endLine) => onQuote('metainfo.xml', text, startLine, endLine) : undefined}
          />
        </CollapsibleCard>
      )}

      {sourceFiles && sourceFiles.length > 0 && (
        <CollapsibleCard
          title="Source Files"
          icon={<FolderOpen className="w-5 h-5 text-gray-400" />}
        >
          <SourceFileTabs files={sourceFiles} onQuote={onQuote} />
        </CollapsibleCard>
      )}
    </>
  );
}
