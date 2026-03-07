import { useState, useCallback } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Search, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  REQUIRED_FIELDS,
  OPTIONAL_FIELDS,
  OPTIONAL_FIELD_KEYS,
  MODULE_FIELDS,
  SOURCE_TYPES,
  type Manifest,
  type ManifestModule,
  type FieldDef,
} from '../utils/manifest';
import { classifyPermission, getOverallSeverity, SEVERITY_CONFIG } from '../utils/permissions';

interface ManifestFormProps {
  manifest: Manifest;
  onChange: (manifest: Manifest) => void;
  lockedAppId: string;
}

// Generic field renderer
function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (val: unknown) => void;
  disabled?: boolean;
}) {
  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="accent-emerald-600 w-4 h-4"
        />
        <span className="text-sm text-gray-700">{field.label}</span>
      </label>
    );
  }

  if (field.type === 'enum') {
    return (
      <select
        value={(value as string) || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        disabled={disabled}
        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <option value="">Select...</option>
        {field.enum?.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (field.type === 'number') {
    return (
      <input
        type="number"
        value={value !== undefined && value !== null ? String(value) : ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        disabled={disabled}
        placeholder={field.placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    );
  }

  return (
    <input
      type="text"
      value={(value as string) || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={field.placeholder}
      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:text-gray-500"
    />
  );
}

// String array editor (for finish-args, config-opts, etc.)
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
            className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="text-red-400 hover:text-red-600 p-0.5"
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
          className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="button"
          onClick={addItem}
          disabled={!draft.trim()}
          className="text-emerald-600 hover:text-emerald-700 disabled:text-gray-300 p-0.5"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// Permission severity badge
function PermissionBadge({ finishArgs }: { finishArgs: string[] }) {
  if (finishArgs.length === 0) return null;

  const results = finishArgs.map(classifyPermission);
  const severity = getOverallSeverity(results);
  const config = SEVERITY_CONFIG[severity];
  const SeverityIcon = severity === 'safe' ? ShieldCheck : severity === 'caution' ? Shield : ShieldAlert;

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${config.badge}`}>
      <SeverityIcon className="w-3.5 h-3.5" />
      {config.label}
    </div>
  );
}

// Source editor for a single source entry
function SourceEditor({
  source,
  onChange,
  onRemove,
}: {
  source: Record<string, unknown>;
  onChange: (s: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const sourceType = (source.type as string) || 'archive';
  const typeDef = SOURCE_TYPES.find(t => t.type === sourceType) || SOURCE_TYPES[0];

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2.5 bg-gray-50/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Source Type</label>
          <select
            value={sourceType}
            onChange={(e) => onChange({ type: e.target.value })}
            className="rounded border border-gray-200 px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {SOURCE_TYPES.map(t => (
              <option key={t.type} value={t.type}>{t.label}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-600">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {typeDef.fields.map(field => {
        if (field.type === 'string-array') {
          return (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
              <StringArrayInput
                value={(source[field.key] as string[]) || []}
                onChange={(val) => onChange({ ...source, [field.key]: val })}
              />
            </div>
          );
        }
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-gray-500 mb-0.5">
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <FieldInput
              field={field}
              value={source[field.key]}
              onChange={(val) => onChange({ ...source, [field.key]: val })}
            />
          </div>
        );
      })}
    </div>
  );
}

// Module editor
function ModuleEditor({
  module,
  index,
  onChange,
  onRemove,
}: {
  module: ManifestModule;
  index: number;
  onChange: (m: ManifestModule) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const updateField = useCallback((key: string, val: unknown) => {
    const next = { ...module, [key]: val };
    if (val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) {
      delete next[key];
    }
    onChange(next);
  }, [module, onChange]);

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 rounded-t-lg"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <span className="text-sm font-medium text-gray-700">
            {module.name || `Module ${index + 1}`}
          </span>
          {module.buildsystem && (
            <span className="text-xs text-gray-400 font-mono">{module.buildsystem}</span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="text-red-400 hover:text-red-600"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-3">
          {MODULE_FIELDS.map(field => {
            if (field.type === 'string-array') {
              const val = (module[field.key] as string[]) || [];
              return (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
                  <StringArrayInput
                    value={val}
                    onChange={(v) => updateField(field.key, v)}
                  />
                </div>
              );
            }
            return (
              <div key={field.key}>
                <label className="block text-xs font-medium text-gray-500 mb-0.5">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                <FieldInput
                  field={field}
                  value={module[field.key]}
                  onChange={(val) => updateField(field.key, val)}
                />
              </div>
            );
          })}

          {/* Sources */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Sources</label>
            <div className="space-y-2">
              {(module.sources || []).map((src, si) => (
                <SourceEditor
                  key={si}
                  source={src}
                  onChange={(s) => {
                    const next = [...(module.sources || [])];
                    next[si] = s;
                    updateField('sources', next);
                  }}
                  onRemove={() => {
                    const next = (module.sources || []).filter((_, j) => j !== si);
                    updateField('sources', next);
                  }}
                />
              ))}
              <button
                type="button"
                onClick={() => updateField('sources', [...(module.sources || []), { type: 'archive' }])}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add Source
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// "Add Field" picker
function AddFieldPicker({
  activeKeys,
  onAdd,
}: {
  activeKeys: Set<string>;
  onAdd: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const available = OPTIONAL_FIELDS.filter(
    f => !activeKeys.has(f.key) && f.label.toLowerCase().includes(search.toLowerCase())
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium mt-2"
      >
        <Plus className="w-4 h-4" /> Add Section
      </button>
    );
  }

  return (
    <div className="border border-emerald-200 rounded-lg p-3 mt-2 bg-emerald-50/30">
      <div className="flex items-center gap-2 mb-2">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search sections..."
          autoFocus
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
        <button
          type="button"
          onClick={() => { setOpen(false); setSearch(''); }}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {available.length === 0 ? (
          <p className="text-xs text-gray-400 py-2 text-center">No matching sections</p>
        ) : (
          available.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => { onAdd(f.key); setOpen(false); setSearch(''); }}
              className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-emerald-100 transition-colors"
            >
              <span className="font-medium text-gray-700">{f.label}</span>
              {f.description && (
                <span className="text-xs text-gray-400 ml-2">{f.description}</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default function ManifestForm({ manifest, onChange, lockedAppId }: ManifestFormProps) {
  const appIdMismatch = manifest.id && manifest.id !== lockedAppId;

  // Determine which optional fields are currently active in the manifest
  const activeOptionalKeys = new Set<string>();
  for (const key of Object.keys(manifest)) {
    if (OPTIONAL_FIELD_KEYS.has(key)) {
      activeOptionalKeys.add(key);
    }
  }

  const updateField = useCallback((key: string, val: unknown) => {
    const next = { ...manifest, [key]: val };
    // Clean up empty values (except required fields)
    if ((val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) && !REQUIRED_FIELDS.some(f => f.key === key)) {
      delete next[key];
    }
    onChange(next);
  }, [manifest, onChange]);

  const handleAddOptionalField = useCallback((key: string) => {
    const field = OPTIONAL_FIELDS.find(f => f.key === key);
    if (!field) return;
    const defaultVal = field.type === 'string-array' ? [] : field.type === 'boolean' ? false : '';
    onChange({ ...manifest, [key]: defaultVal });
  }, [manifest, onChange]);

  const handleRemoveOptionalField = useCallback((key: string) => {
    const next = { ...manifest };
    delete next[key];
    onChange(next);
  }, [manifest, onChange]);

  return (
    <div className="space-y-4 p-4">
      {/* App ID error */}
      {appIdMismatch && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          App ID must be <span className="font-mono font-semibold">{lockedAppId}</span>.
          You cannot submit a manifest for a different app.
        </div>
      )}

      {/* Required fields */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Required</h3>
        {REQUIRED_FIELDS.map(field => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-gray-700 mb-0.5">
              {field.label} <span className="text-red-500">*</span>
            </label>
            <FieldInput
              field={field}
              value={manifest[field.key]}
              onChange={(val) => updateField(field.key, val)}
              disabled={field.key === 'id'}
            />
            {field.description && (
              <p className="text-xs text-gray-400 mt-0.5">{field.description}</p>
            )}
          </div>
        ))}
      </div>

      {/* Active optional fields */}
      {activeOptionalKeys.size > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Options</h3>
          {OPTIONAL_FIELDS.filter(f => activeOptionalKeys.has(f.key)).map(field => (
            <div key={field.key}>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-sm font-medium text-gray-700">
                  {field.label}
                </label>
                <div className="flex items-center gap-2">
                  {field.key === 'finish-args' && (
                    <PermissionBadge finishArgs={(manifest['finish-args'] as string[]) || []} />
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveOptionalField(field.key)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {field.type === 'string-array' ? (
                <StringArrayInput
                  value={(manifest[field.key] as string[]) || []}
                  onChange={(val) => updateField(field.key, val)}
                  placeholder={field.key === 'finish-args' ? '--share=ipc' : undefined}
                />
              ) : (
                <FieldInput
                  field={field}
                  value={manifest[field.key]}
                  onChange={(val) => updateField(field.key, val)}
                />
              )}
              {field.description && (
                <p className="text-xs text-gray-400 mt-0.5">{field.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modules */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Modules <span className="text-red-500">*</span>
        </h3>
        {(manifest.modules || []).map((mod, i) => (
          <ModuleEditor
            key={`${i}-${mod.name}`}
            module={mod}
            index={i}
            onChange={(m) => {
              const next = [...(manifest.modules || [])];
              next[i] = m;
              updateField('modules', next);
            }}
            onRemove={() => {
              const next = (manifest.modules || []).filter((_, j) => j !== i);
              updateField('modules', next);
            }}
          />
        ))}
        <button
          type="button"
          onClick={() => {
            const next = [...(manifest.modules || []), { name: '', buildsystem: 'simple', sources: [] }];
            updateField('modules', next);
          }}
          className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
        >
          <Plus className="w-4 h-4" /> Add Module
        </button>
      </div>

      {/* Add optional section */}
      <AddFieldPicker
        activeKeys={activeOptionalKeys}
        onAdd={handleAddOptionalField}
      />
    </div>
  );
}
