import { useState, useCallback } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, AlertCircle, AlertTriangle, Info, Eye, X, List } from 'lucide-react';
import {
  METADATA_LICENSES,
  COMPONENT_TYPES,
  URL_TYPES,
  validateMetainfo,
  type MetainfoData,
  type ValidationMessage,
  type DescriptionBlock,
} from '../utils/metainfo';

interface MetainfoFormProps {
  data: MetainfoData;
  onChange: (data: MetainfoData) => void;
  lockedAppId: string;
}

// Expandable validation panel grouped by category
function ValidationPanel({ messages }: { messages: ValidationMessage[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (messages.length === 0) return null;

  const errors = messages.filter(m => m.severity === 'error');
  const warnings = messages.filter(m => m.severity === 'warning');
  const infos = messages.filter(m => m.severity === 'info');

  const groups: { severity: 'error' | 'warning' | 'info'; items: ValidationMessage[]; label: string; Icon: typeof AlertCircle; color: string; bg: string }[] = [];
  if (errors.length > 0) groups.push({ severity: 'error', items: errors, label: `${errors.length} error${errors.length > 1 ? 's' : ''}`, Icon: AlertCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800' });
  if (warnings.length > 0) groups.push({ severity: 'warning', items: warnings, label: `${warnings.length} warning${warnings.length > 1 ? 's' : ''}`, Icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800' });
  if (infos.length > 0) groups.push({ severity: 'info', items: infos, label: `${infos.length} suggestion${infos.length > 1 ? 's' : ''}`, Icon: Info, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800' });

  return (
    <div className="space-y-2">
      {groups.map(({ severity, items, label, Icon, color, bg }) => {
        const isOpen = expanded[severity] ?? (severity === 'error');
        return (
          <div key={severity} className={`border rounded-lg ${bg}`}>
            <button
              type="button"
              onClick={() => setExpanded(prev => ({ ...prev, [severity]: !isOpen }))}
              className={`flex items-center gap-1.5 w-full px-3 py-1.5 text-xs font-medium ${color}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {isOpen ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronRight className="w-3 h-3 ml-auto" />}
            </button>
            {isOpen && (
              <div className="px-3 pb-2 space-y-0.5">
                {items.map((m, i) => (
                  <div key={i} className={`text-xs ${color} pl-5`}>
                    <span className="text-gray-400 mr-1">[{m.field}]</span>
                    {m.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Description block editor (supports p, ul, ol)
function DescriptionBlockEditor({
  blocks,
  onChange,
  label,
}: {
  blocks: DescriptionBlock[];
  onChange: (val: DescriptionBlock[]) => void;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      {blocks.map((block, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <select
            value={block.type}
            onChange={(e) => {
              const next = [...blocks];
              next[i] = { ...block, type: e.target.value as DescriptionBlock['type'] };
              onChange(next);
            }}
            className="rounded border border-gray-200 dark:border-gray-600 px-1.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-14 shrink-0 mt-px"
          >
            <option value="p">&lt;p&gt;</option>
            <option value="ul">&lt;ul&gt;</option>
            <option value="ol">&lt;ol&gt;</option>
          </select>
          <textarea
            value={block.content}
            onChange={(e) => {
              const next = [...blocks];
              next[i] = { ...block, content: e.target.value };
              onChange(next);
            }}
            rows={block.type === 'p' ? 2 : 3}
            placeholder={block.type === 'p' ? 'Paragraph text...' : 'One list item per line...'}
            className="flex-1 rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          {blocks.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(blocks.filter((_, j) => j !== i))}
              className="text-red-400 hover:text-red-600 dark:hover:text-red-400 p-0.5 mt-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange([...blocks, { type: 'p', content: '' }])}
          className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Paragraph
        </button>
        <button
          type="button"
          onClick={() => onChange([...blocks, { type: 'ul', content: '' }])}
          className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
        >
          <List className="w-3.5 h-3.5" /> List
        </button>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  badge,
  defaultOpen,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-t-lg"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
        {badge && <span className="text-xs text-gray-400">{badge}</span>}
      </div>
      {open && (
        <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

// Screenshot preview lightbox
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300"
      >
        <X className="w-6 h-6" />
      </button>
      <img
        src={src}
        alt="Screenshot preview"
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export default function MetainfoForm({ data, onChange, lockedAppId }: MetainfoFormProps) {
  const messages = validateMetainfo(data, lockedAppId);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const update = useCallback(<K extends keyof MetainfoData>(key: K, val: MetainfoData[K]) => {
    onChange({ ...data, [key]: val });
  }, [data, onChange]);

  const idMismatch = data.id.trim() !== '' && data.id !== lockedAppId;

  // Releases displayed in reverse order (newest last) for editing
  const displayReleases = [...data.releases].reverse();

  return (
    <div className="space-y-4 p-4">
      {/* Lightbox */}
      {previewImage && <ImageLightbox src={previewImage} onClose={() => setPreviewImage(null)} />}

      {/* Validation */}
      {messages.length > 0 && (
        <ValidationPanel messages={messages} />
      )}

      {/* ID mismatch error */}
      {idMismatch && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
          ID must be <span className="font-mono font-semibold">{lockedAppId}</span>.
        </div>
      )}

      {/* Core fields */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Required</h3>

        {/* ID (locked) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-0.5">
            ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.id}
            disabled
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
          />
        </div>

        {/* Component type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-0.5">Component Type</label>
          <select
            value={data.component_type}
            onChange={(e) => update('component_type', e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {COMPONENT_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Metadata license */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-0.5">
            Metadata License <span className="text-red-500">*</span>
          </label>
          <select
            value={data.metadata_license}
            onChange={(e) => update('metadata_license', e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Select...</option>
            {METADATA_LICENSES.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">License for the metainfo file itself</p>
        </div>

        {/* Project license */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-0.5">
            Project License <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.project_license}
            onChange={(e) => update('project_license', e.target.value)}
            placeholder="GPL-3.0-or-later"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">SPDX identifier (e.g. MIT, GPL-3.0-or-later, Apache-2.0)</p>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-0.5">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="My App"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Summary */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-0.5">
            Summary <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.summary}
            onChange={(e) => update('summary', e.target.value)}
            placeholder="A short description of the app"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Description */}
        <DescriptionBlockEditor
          blocks={data.description}
          onChange={(val) => update('description', val)}
          label="Description *"
        />

        {/* Developer */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-0.5">
              Developer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.developer_name}
              onChange={(e) => update('developer_name', e.target.value)}
              placeholder="Your Name"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-0.5">Developer ID</label>
            <input
              type="text"
              value={data.developer_id}
              onChange={(e) => update('developer_id', e.target.value)}
              placeholder="com.example"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Content Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-0.5">
            Content Rating <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.content_rating_type}
            onChange={(e) => update('content_rating_type', e.target.value)}
            placeholder="oars-1.1"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Use <a href="https://hughsie.github.io/oars/generate.html" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline">OARS generator</a> for detailed ratings
          </p>
        </div>
      </div>

      {/* URLs */}
      <CollapsibleSection title="URLs" badge={`${data.urls.filter(u => u.value.trim()).length} configured`} defaultOpen>
        <div className="space-y-2">
          {data.urls.map((u, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={u.type}
                onChange={(e) => {
                  const next = [...data.urls];
                  next[i] = { ...u, type: e.target.value };
                  update('urls', next);
                }}
                className="rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 w-32 shrink-0"
              >
                {URL_TYPES.map(t => (
                  <option key={t.type} value={t.type}>{t.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={u.value}
                onChange={(e) => {
                  const next = [...data.urls];
                  next[i] = { ...u, value: e.target.value };
                  update('urls', next);
                }}
                placeholder="https://..."
                className="flex-1 rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => update('urls', data.urls.filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-600 dark:hover:text-red-400 p-0.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => update('urls', [...data.urls, { type: 'bugtracker', value: '' }])}
            className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Add URL
          </button>
        </div>
      </CollapsibleSection>

      {/* Releases (displayed in reverse: oldest first, newest last) */}
      <CollapsibleSection title="Releases" badge={`${data.releases.length}`} defaultOpen>
        <div className="space-y-3">
          {displayReleases.map((r, displayIdx) => {
            // Map display index back to data index (reversed)
            const dataIdx = data.releases.length - 1 - displayIdx;
            return (
              <div key={dataIdx} className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 space-y-2 bg-gray-50/50 dark:bg-gray-950/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    {r.version.trim() ? `v${r.version}` : `Release ${dataIdx + 1}`}
                    {r.date.trim() ? ` (${r.date})` : ''}
                  </span>
                  {data.releases.length > 1 && (
                    <button
                      type="button"
                      onClick={() => update('releases', data.releases.filter((_, j) => j !== dataIdx))}
                      className="text-red-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                      Version <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={r.version}
                      onChange={(e) => {
                        const next = [...data.releases];
                        next[dataIdx] = { ...r, version: e.target.value };
                        update('releases', next);
                      }}
                      placeholder="1.0.0"
                      className="w-full rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={r.date}
                      onChange={(e) => {
                        const next = [...data.releases];
                        next[dataIdx] = { ...r, date: e.target.value };
                        update('releases', next);
                      }}
                      className="w-full rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <DescriptionBlockEditor
                  blocks={r.description}
                  onChange={(val) => {
                    const next = [...data.releases];
                    next[dataIdx] = { ...r, description: val };
                    update('releases', next);
                  }}
                  label="Release Notes"
                />
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => {
              // New releases are added at position 0 (newest in XML) but shown at bottom in form
              update('releases', [{ version: '', date: '', description: [{ type: 'p', content: '' }] }, ...data.releases]);
            }}
            className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Add Release
          </button>
        </div>
      </CollapsibleSection>

      {/* Screenshots */}
      <CollapsibleSection title="Screenshots" badge={data.screenshots.length > 0 ? `${data.screenshots.length}` : undefined}>
        <div className="space-y-2">
          {data.screenshots.map((s, i) => (
            <div key={i} className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 space-y-2 bg-gray-50/50 dark:bg-gray-950/50">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={s.isDefault}
                    onChange={(e) => {
                      const next = data.screenshots.map((ss, j) => ({
                        ...ss,
                        isDefault: j === i ? e.target.checked : false,
                      }));
                      update('screenshots', next);
                    }}
                    className="accent-emerald-600"
                  />
                  <span className="text-gray-500 dark:text-gray-400">Default</span>
                </label>
                <div className="flex items-center gap-1">
                  {s.image.trim() && (
                    <button
                      type="button"
                      onClick={() => setPreviewImage(s.image)}
                      className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 p-0.5"
                      title="Preview screenshot"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => update('screenshots', data.screenshots.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600 dark:hover:text-red-400 p-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Image URL <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={s.image}
                  onChange={(e) => {
                    const next = [...data.screenshots];
                    next[i] = { ...s, image: e.target.value };
                    update('screenshots', next);
                  }}
                  placeholder="https://example.com/screenshot.png"
                  className="w-full rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Caption</label>
                <input
                  type="text"
                  value={s.caption}
                  onChange={(e) => {
                    const next = [...data.screenshots];
                    next[i] = { ...s, caption: e.target.value };
                    update('screenshots', next);
                  }}
                  placeholder="Main window"
                  className="w-full rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => update('screenshots', [...data.screenshots, { image: '', caption: '', isDefault: data.screenshots.length === 0 }])}
            className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Add Screenshot
          </button>
        </div>
      </CollapsibleSection>

      {/* Optional: Launchable, Categories, Keywords */}
      <CollapsibleSection title="Optional">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-0.5">Launchable (Desktop ID)</label>
            <input
              type="text"
              value={data.launchable}
              onChange={(e) => update('launchable', e.target.value)}
              placeholder={`${lockedAppId}.desktop`}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Categories</label>
            <StringArrayInput
              value={data.categories}
              onChange={(val) => update('categories', val)}
              placeholder="e.g. Utility, Graphics..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Keywords</label>
            <StringArrayInput
              value={data.keywords}
              onChange={(val) => update('keywords', val)}
              placeholder="e.g. editor, viewer..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Provides (Binaries)</label>
            <StringArrayInput
              value={data.provides_binaries}
              onChange={(val) => update('provides_binaries', val)}
              placeholder="e.g. myapp"
            />
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

function StringArrayInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (val: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  const addItem = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      onChange([...value, trimmed]);
      setDraft('');
    }
  };

  return (
    <div className="space-y-1.5">
      {value.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            type="text"
            value={item}
            onChange={(e) => {
              const next = [...value];
              next[i] = e.target.value;
              onChange(next);
            }}
            className="flex-1 rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="text-red-400 hover:text-red-600 dark:hover:text-red-400 p-0.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          placeholder={placeholder || 'Add item...'}
          className="flex-1 rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="button"
          onClick={addItem}
          disabled={!draft.trim()}
          className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 disabled:text-gray-300 dark:disabled:text-gray-600 p-0.5"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
