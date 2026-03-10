import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleCardProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  headerRight?: ReactNode;
  children: ReactNode;
}

export default function CollapsibleCard({
  title,
  icon,
  defaultOpen = false,
  headerRight,
  children,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-t-xl"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        )}
        {icon}
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {headerRight && <span className="ml-auto">{headerRight}</span>}
      </button>
      {open && <div className="border-t border-gray-100 dark:border-gray-800">{children}</div>}
    </div>
  );
}
