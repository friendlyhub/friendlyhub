import catalog from '../data/flatpak-permissions.catalog.json';

export type Severity = 'safe' | 'caution' | 'sensitive';

interface CatalogRule {
  id: string;
  category: string;
  priority: number;
  severity: Severity;
  description: string;
  match: { type: 'exact'; value: string } | { type: 'regex'; pattern: string };
}

export interface MatchResult {
  ruleId: string;
  category: string;
  severity: Severity;
  description: string;
  permission: string;
}

const rules = catalog.permissions as CatalogRule[];

// Pre-compile regex patterns
const compiledRegexRules: Array<{ rule: CatalogRule; regex: RegExp }> = [];
for (const rule of rules) {
  if (rule.match.type === 'regex') {
    // Convert Python named groups (?P<name>...) to JS named groups (?<name>...)
    const jsPattern = rule.match.pattern.replace(/\(\?P</g, '(?<');
    compiledRegexRules.push({ rule, regex: new RegExp(jsPattern) });
  }
}

function computeModeSuffix(captures: Record<string, string>): string {
  const mode = captures.mode;
  if (mode === 'ro') return ' (read-only)';
  if (mode === 'create') return ' with permission to create it if needed';
  return '';
}

function computePathSuffix(captures: Record<string, string>): string {
  if (captures.subpath) return ` at ${captures.subpath}`;
  if (captures.run_path) return ` ${captures.run_path}`;
  return '';
}

function computeDeviceSuffix(captures: Record<string, string>): string {
  if (captures.device) return ` device ${captures.device}`;
  return '';
}

function computeClassSuffix(captures: Record<string, string>): string {
  if (captures.class && captures.subclass) return ` in USB class ${captures.class} subclass ${captures.subclass}`;
  if (captures.class) return ` in USB class ${captures.class}`;
  return '';
}

const XDG_LABELS: Record<string, string> = {
  Desktop: 'Desktop', Documents: 'Documents', Downloads: 'Downloads',
  Music: 'Music', Pictures: 'Pictures', Public: 'Public',
  Videos: 'Videos', Templates: 'Templates', config: 'config',
  cache: 'cache', data: 'data',
};

function renderDescription(template: string, captures: Record<string, string>): string {
  const values: Record<string, string> = { ...captures };
  values.mode_suffix = computeModeSuffix(captures);
  values.path_suffix = computePathSuffix(captures);
  values.device_suffix = computeDeviceSuffix(captures);
  values.class_suffix = computeClassSuffix(captures);

  let rendered = template;
  // Replace XDG folder label placeholders
  for (const [key, label] of Object.entries(XDG_LABELS)) {
    rendered = rendered.replaceAll(`[${key}]`, label);
  }
  for (const [key, value] of Object.entries(values)) {
    rendered = rendered.replaceAll(`[${key}]`, value || '');
  }
  return rendered;
}

export function classifyPermission(permission: string): MatchResult {
  const input = permission.trim();

  // Exact matches
  const exactCandidates: Array<{ rule: CatalogRule; captures: Record<string, string> }> = [];
  for (const rule of rules) {
    if (rule.match.type === 'exact' && input === rule.match.value) {
      exactCandidates.push({ rule, captures: {} });
    }
  }

  if (exactCandidates.length > 0) {
    exactCandidates.sort((a, b) => {
      if (b.rule.priority !== a.rule.priority) return b.rule.priority - a.rule.priority;
      const aLen = a.rule.match.type === 'exact' ? a.rule.match.value.length : 0;
      const bLen = b.rule.match.type === 'exact' ? b.rule.match.value.length : 0;
      if (bLen !== aLen) return bLen - aLen;
      return a.rule.id.localeCompare(b.rule.id);
    });
    const { rule, captures } = exactCandidates[0];
    return {
      ruleId: rule.id,
      category: rule.category,
      severity: rule.severity,
      description: renderDescription(rule.description, captures),
      permission: input,
    };
  }

  // Regex matches
  const regexCandidates: Array<{ rule: CatalogRule; captures: Record<string, string> }> = [];
  for (const { rule, regex } of compiledRegexRules) {
    const m = regex.exec(input);
    if (m) {
      const captures: Record<string, string> = {};
      if (m.groups) {
        for (const [k, v] of Object.entries(m.groups)) {
          if (v !== undefined) captures[k] = v;
        }
      }
      regexCandidates.push({ rule, captures });
    }
  }

  if (regexCandidates.length > 0) {
    regexCandidates.sort((a, b) => {
      if (b.rule.priority !== a.rule.priority) return b.rule.priority - a.rule.priority;
      const aLen = a.rule.match.type === 'regex' ? a.rule.match.pattern.length : 0;
      const bLen = b.rule.match.type === 'regex' ? b.rule.match.pattern.length : 0;
      if (bLen !== aLen) return bLen - aLen;
      return a.rule.id.localeCompare(b.rule.id);
    });
    const { rule, captures } = regexCandidates[0];
    return {
      ruleId: rule.id,
      category: rule.category,
      severity: rule.severity,
      description: renderDescription(rule.description, captures),
      permission: input,
    };
  }

  // Fallback for unknown permissions
  return {
    ruleId: 'unknown',
    category: 'unknown',
    severity: 'caution',
    description: `Unknown permission: ${input}`,
    permission: input,
  };
}

const SEVERITY_ORDER: Record<Severity, number> = { sensitive: 0, caution: 1, safe: 2 };

export function getOverallSeverity(results: MatchResult[]): Severity {
  if (results.some((r) => r.severity === 'sensitive')) return 'sensitive';
  if (results.some((r) => r.severity === 'caution')) return 'caution';
  return 'safe';
}

export function sortBySeverity(results: MatchResult[]): MatchResult[] {
  return [...results].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

// Icon names (lucide-react) mapped by category, with per-rule overrides
const RULE_ICON_OVERRIDES: Record<string, string> = {
  'device-dri': 'Monitor',
  'device-kvm': 'Server',
  'device-input': 'Mouse',
  'device-usb': 'Usb',
  'device-shm': 'MemoryStick',
  'share-network': 'Wifi',
  'share-ipc': 'ArrowLeftRight',
  'socket-wayland': 'AppWindow',
  'socket-x11': 'AppWindow',
  'socket-fallback-x11': 'AppWindow',
  'socket-pulseaudio': 'Volume2',
  'socket-cups': 'Printer',
  'socket-gpg-agent': 'Key',
  'socket-ssh-auth': 'Key',
  'socket-session-bus': 'Radio',
  'socket-system-bus': 'Radio',
  'allow-bluetooth': 'Bluetooth',
};

const CATEGORY_ICONS: Record<string, string> = {
  share: 'Share2',
  socket: 'Plug',
  device: 'Cpu',
  filesystem: 'FolderOpen',
  dbus: 'Radio',
  persist: 'Database',
  usb: 'Usb',
  allow: 'ToggleRight',
  env: 'Settings',
  metadata: 'FileText',
  unknown: 'ShieldQuestion',
};

export function getPermissionIcon(result: MatchResult): string {
  return RULE_ICON_OVERRIDES[result.ruleId] || CATEGORY_ICONS[result.category] || 'Shield';
}

export const SEVERITY_CONFIG = {
  safe: {
    label: 'Safe',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    dot: 'bg-green-500',
    badge: 'bg-green-100 text-green-800',
    summary: 'This app requests permissions that are generally considered safe.',
  },
  caution: {
    label: 'Caution',
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    dot: 'bg-amber-500',
    badge: 'bg-yellow-100 text-yellow-800',
    summary: 'This app requests permissions that could potentially be dangerous if misused. Make sure to review.',
  },
  sensitive: {
    label: 'Sensitive',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
    badge: 'bg-orange-100 text-orange-800',
    summary: 'This app requests permissions that are considered sensitive and could potentially harm your system or privacy.',
  },
} as const;
