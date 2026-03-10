import type { RefObject } from 'react';
import { Bold, Italic, List, ListOrdered, Code, Heading2 } from 'lucide-react';

interface MarkdownToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
}

type InsertAction = {
  type: 'wrap';
  before: string;
  after: string;
} | {
  type: 'line-prefix';
  prefix: string;
};

function applyAction(
  textarea: HTMLTextAreaElement,
  value: string,
  action: InsertAction,
  onChange: (v: string) => void,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = value.slice(start, end);

  let newValue: string;
  let cursorStart: number;
  let cursorEnd: number;

  if (action.type === 'wrap') {
    const wrapped = `${action.before}${selected || 'text'}${action.after}`;
    newValue = value.slice(0, start) + wrapped + value.slice(end);
    cursorStart = start + action.before.length;
    cursorEnd = cursorStart + (selected || 'text').length;
  } else {
    // Line prefix: add prefix to each selected line, or current line
    if (selected) {
      const lines = selected.split('\n');
      const prefixed = lines.map((line, i) => {
        if (action.prefix === '1. ') {
          return `${i + 1}. ${line}`;
        }
        return `${action.prefix}${line}`;
      }).join('\n');
      newValue = value.slice(0, start) + prefixed + value.slice(end);
      cursorStart = start;
      cursorEnd = start + prefixed.length;
    } else {
      const prefix = action.prefix === '1. ' ? '1. ' : action.prefix;
      const insert = `${prefix}`;
      newValue = value.slice(0, start) + insert + value.slice(end);
      cursorStart = start + insert.length;
      cursorEnd = cursorStart;
    }
  }

  onChange(newValue);

  // Restore cursor position after React re-renders
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(cursorStart, cursorEnd);
  });
}

const actions: Array<{
  label: string;
  icon: typeof Bold;
  action: InsertAction;
}> = [
  { label: 'Bold', icon: Bold, action: { type: 'wrap', before: '**', after: '**' } },
  { label: 'Italic', icon: Italic, action: { type: 'wrap', before: '_', after: '_' } },
  { label: 'Code', icon: Code, action: { type: 'wrap', before: '`', after: '`' } },
  { label: 'Heading', icon: Heading2, action: { type: 'line-prefix', prefix: '## ' } },
  { label: 'Bullet list', icon: List, action: { type: 'line-prefix', prefix: '- ' } },
  { label: 'Numbered list', icon: ListOrdered, action: { type: 'line-prefix', prefix: '1. ' } },
];

export default function MarkdownToolbar({ textareaRef, value, onChange }: MarkdownToolbarProps) {
  return (
    <div className="flex items-center gap-0.5 px-1 py-1 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 border-b-0 rounded-t-lg">
      {actions.map(({ label, icon: Icon, action }) => (
        <button
          key={label}
          type="button"
          title={label}
          onClick={() => {
            if (textareaRef.current) {
              applyAction(textareaRef.current, value, action, onChange);
            }
          }}
          className="p-1.5 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
      <span className="ml-auto text-[10px] text-gray-400 pr-1">Markdown supported</span>
    </div>
  );
}
