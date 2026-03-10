import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Copy, Check } from 'lucide-react';
import { getDistroBySlug } from '../content/distros';

function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, '');
  const isBlock = className?.startsWith('language-');

  const copy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  if (!isBlock) {
    return <code className={className}>{children}</code>;
  }

  return (
    <div className="relative">
      <pre className="whitespace-pre-wrap wrap-break-word pr-12"><code className={className}>{code}</code></pre>
      <button
        onClick={copy}
        className="absolute top-3 right-3 p-1.5 rounded-md text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
        title="Copy to clipboard"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function SetupDistro() {
  const { slug } = useParams<{ slug: string }>();
  const distro = slug ? getDistroBySlug(slug) : undefined;
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!distro) return;
    distro.markdown()
      .then(setContent)
      .catch(() => setError(true));
  }, [distro]);

  if (!distro) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Distribution not found</h1>
        <Link to="/setup" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700">View all distributions</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/setup" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-6 inline-flex items-center gap-1">
        &larr; All distributions
      </Link>

      <div className="flex items-center gap-4 mb-8">
        <svg role="img" viewBox="0 0 24 24" className="w-12 h-12" fill={`#${distro.hex}`}>
          <path d={distro.path} />
        </svg>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{distro.name}</h1>
      </div>

      {error ? (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-6 text-center">
          <p className="text-amber-800 dark:text-amber-300">Instructions for {distro.name} are coming soon.</p>
          <Link to="/setup" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 text-sm mt-2 inline-block">View all distributions</Link>
        </div>
      ) : content === null ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>
      ) : (
        <article className="prose prose-gray dark:prose-invert max-w-none">
          <ReactMarkdown components={{
            code: ({ children, className }) => (
              <CodeBlock className={className}>{String(children)}</CodeBlock>
            ),
            pre: ({ children }) => <>{children}</>,
          }}>{content}</ReactMarkdown>
        </article>
      )}
    </div>
  );
}
