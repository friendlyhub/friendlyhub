import { useState, useCallback } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Search, Shield, ShieldAlert, ShieldCheck, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import {
  REQUIRED_FIELDS,
  OPTIONAL_FIELDS,
  OPTIONAL_FIELD_KEYS,
  MODULE_FIELDS,
  SOURCE_TYPES,
  validateRequired,
  type Manifest,
  type ManifestModule,
  type FieldDef,
} from '../utils/manifest';
import { classifyPermission, getOverallSeverity, SEVERITY_CONFIG } from '../utils/permissions';

interface ValidationMessage {
  severity: 'error' | 'warning' | 'info';
  field: string;
  message: string;
}

interface ManifestFormProps {
  manifest: Manifest;
  onChange: (manifest: Manifest) => void;
  lockedAppId: string;
}

// Expandable validation panel grouped by severity
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
        <span className="text-sm text-gray-700 dark:text-gray-300">{field.label}</span>
      </label>
    );
  }

  if (field.type === 'enum') {
    return (
      <select
        value={(value as string) || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        disabled={disabled}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-900 dark:disabled:text-gray-500"
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
            className="flex-1 rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
          className="flex-1 rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 space-y-2.5 bg-gray-50/50 dark:bg-gray-950/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Source Type</label>
          <select
            value={sourceType}
            onChange={(e) => onChange({ type: e.target.value })}
            className="rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {SOURCE_TYPES.map(t => (
              <option key={t.type} value={t.type}>{t.label}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-600 dark:hover:text-red-400">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {typeDef.fields.map(field => {
        if (field.type === 'string-array') {
          return (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{field.label}</label>
              <StringArrayInput
                value={(source[field.key] as string[]) || []}
                onChange={(val) => onChange({ ...source, [field.key]: val })}
              />
            </div>
          );
        }
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">
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

// External/shared module reference (string entry in modules array)
function ExternalModuleEditor({
  path,
  onChange,
  onRemove,
}: {
  path: string;
  onChange: (val: string) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const filename = path.split('/').pop() || path;

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900">
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-t-lg"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{filename}</span>
          <span className="text-xs text-gray-400">external module</span>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="text-red-400 hover:text-red-600 dark:hover:text-red-400"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-800 pt-3">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Path</label>
          <input
            type="text"
            value={path}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      )}
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
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900">
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-t-lg"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {module.name || `Module ${index + 1}`}
          </span>
          {module.buildsystem && (
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{module.buildsystem}</span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="text-red-400 hover:text-red-600 dark:hover:text-red-400"
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
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{field.label}</label>
                  <StringArrayInput
                    value={val}
                    onChange={(v) => updateField(field.key, v)}
                  />
                </div>
              );
            }
            return (
              <div key={field.key}>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">
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
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Sources</label>
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
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
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
        className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium mt-2"
      >
        <Plus className="w-4 h-4" /> Add Section
      </button>
    );
  }

  return (
    <div className="border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 mt-2 bg-emerald-50/30 dark:bg-emerald-950/30">
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
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
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
              className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors"
            >
              <span className="font-medium text-gray-700 dark:text-gray-300">{f.label}</span>
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
  const effectiveId = manifest.id || manifest['app-id'] || '';
  const appIdMismatch = effectiveId !== '' && effectiveId !== lockedAppId;

  // Build validation messages
  const missingFields = validateRequired(manifest);
  const validationMessages: ValidationMessage[] = [];
  if (appIdMismatch) {
    validationMessages.push({ severity: 'error', field: 'ID', message: `App ID must be ${lockedAppId}` });
  }
  for (const label of missingFields) {
    validationMessages.push({ severity: 'error', field: 'Required', message: `${label} is required` });
  }

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
      {/* Validation alerts */}
      {validationMessages.length > 0 && (
        <ValidationPanel messages={validationMessages} />
      )}

      {/* Required fields */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Required</h3>
        {REQUIRED_FIELDS.map(field => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-0.5">
              {field.label} <span className="text-red-500">*</span>
            </label>
            <FieldInput
              field={field}
              value={manifest[field.key]}
              onChange={(val) => updateField(field.key, val)}
              disabled={field.key === 'id'}
            />
            {field.description && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{field.description}</p>
            )}
          </div>
        ))}
      </div>

      {/* Active optional fields */}
      {activeOptionalKeys.size > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Options</h3>
          {OPTIONAL_FIELDS.filter(f => activeOptionalKeys.has(f.key)).map(field => (
            <div key={field.key}>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {field.label}
                </label>
                <div className="flex items-center gap-2">
                  {field.key === 'finish-args' && (
                    <PermissionBadge finishArgs={(manifest['finish-args'] as string[]) || []} />
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveOptionalField(field.key)}
                    className="text-red-400 hover:text-red-600 dark:hover:text-red-400"
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
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{field.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modules */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Modules <span className="text-red-500">*</span>
        </h3>
        {(manifest.modules || []).map((mod, i) => {
          // String entries are references to external shared module files
          if (typeof mod === 'string') {
            return (
              <ExternalModuleEditor
                key={`${i}-ref`}
                path={mod}
                onChange={(val) => {
                  const next = [...(manifest.modules || [])];
                  next[i] = val as unknown as ManifestModule;
                  updateField('modules', next);
                }}
                onRemove={() => {
                  const next = (manifest.modules || []).filter((_, j) => j !== i);
                  updateField('modules', next);
                }}
              />
            );
          }
          return (
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
          );
        })}
        <button
          type="button"
          onClick={() => {
            const next = [...(manifest.modules || []), { name: '', buildsystem: 'simple', sources: [] }];
            updateField('modules', next);
          }}
          className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
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
