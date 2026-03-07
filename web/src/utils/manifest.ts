// Flatpak manifest schema helpers for the dual-pane editor

export interface FieldDef {
  key: string;
  label: string;
  type: 'string' | 'boolean' | 'number' | 'enum' | 'string-array' | 'object';
  required?: boolean;
  enum?: string[];
  description?: string;
  placeholder?: string;
}

export interface ModuleSourceDef {
  type: string;
  label: string;
  fields: FieldDef[];
}

// Required top-level fields (the user cannot submit without these)
export const REQUIRED_FIELDS: FieldDef[] = [
  { key: 'id', label: 'App ID', type: 'string', required: true, description: 'Reverse-DNS application ID', placeholder: 'org.example.MyApp' },
  { key: 'runtime', label: 'Runtime', type: 'string', required: true, description: 'The runtime this app uses', placeholder: 'org.freedesktop.Platform' },
  { key: 'runtime-version', label: 'Runtime Version', type: 'string', required: true, description: 'Version of the runtime', placeholder: '24.08' },
  { key: 'sdk', label: 'SDK', type: 'string', required: true, description: 'The SDK used to build the app', placeholder: 'org.freedesktop.Sdk' },
  { key: 'command', label: 'Command', type: 'string', required: true, description: 'The command to run when starting the app', placeholder: 'myapp' },
];

// Optional top-level fields available via the "+" button
export const OPTIONAL_FIELDS: FieldDef[] = [
  { key: 'branch', label: 'Branch', type: 'string', description: 'The branch to use for the app' },
  { key: 'default-branch', label: 'Default Branch', type: 'string', description: 'The default branch to use' },
  { key: 'collection-id', label: 'Collection ID', type: 'string', description: 'The collection ID for P2P distribution' },
  { key: 'base', label: 'Base App', type: 'string', description: 'Base application to build on top of', placeholder: 'io.qt.qtwebengine.BaseApp' },
  { key: 'base-version', label: 'Base Version', type: 'string', description: 'Version of the base app' },
  { key: 'sdk-extensions', label: 'SDK Extensions', type: 'string-array', description: 'SDK extensions to install' },
  { key: 'platform-extensions', label: 'Platform Extensions', type: 'string-array', description: 'Platform extensions to install' },
  { key: 'base-extensions', label: 'Base Extensions', type: 'string-array', description: 'Extensions from the base app to keep' },
  { key: 'inherit-extensions', label: 'Inherit Extensions', type: 'string-array', description: 'Extensions to inherit from the runtime' },
  { key: 'inherit-sdk-extensions', label: 'Inherit SDK Extensions', type: 'string-array', description: 'SDK extensions to inherit' },
  { key: 'tags', label: 'Tags', type: 'string-array', description: 'Tags for the build' },
  { key: 'finish-args', label: 'Finish Args (Permissions)', type: 'string-array', description: 'Sandbox permissions for the app' },
  { key: 'cleanup', label: 'Cleanup', type: 'string-array', description: 'Files/directories to remove after build' },
  { key: 'cleanup-commands', label: 'Cleanup Commands', type: 'string-array', description: 'Commands to run during cleanup' },
  { key: 'rename-desktop-file', label: 'Rename Desktop File', type: 'string', description: 'Rename the desktop file to match the app ID' },
  { key: 'rename-appdata-file', label: 'Rename AppData File', type: 'string', description: 'Rename the appdata file' },
  { key: 'rename-icon', label: 'Rename Icon', type: 'string', description: 'Rename the icon to match the app ID' },
  { key: 'copy-icon', label: 'Copy Icon', type: 'boolean', description: 'Copy the icon instead of renaming' },
  { key: 'desktop-file-name-prefix', label: 'Desktop File Name Prefix', type: 'string', description: 'Prefix for the desktop file name' },
  { key: 'desktop-file-name-suffix', label: 'Desktop File Name Suffix', type: 'string', description: 'Suffix for the desktop file name' },
  { key: 'appstream-compose', label: 'AppStream Compose', type: 'boolean', description: 'Run appstreamcli compose' },
  { key: 'separate-locales', label: 'Separate Locales', type: 'boolean', description: 'Whether to separate locale data' },
  { key: 'build-runtime', label: 'Build Runtime', type: 'boolean', description: 'Build a runtime instead of an app' },
  { key: 'build-extension', label: 'Build Extension', type: 'boolean', description: 'Build an extension' },
  { key: 'writable-sdk', label: 'Writable SDK', type: 'boolean', description: 'Make the SDK writable during build' },
];

// All optional field keys for quick lookup
export const OPTIONAL_FIELD_KEYS = new Set(OPTIONAL_FIELDS.map(f => f.key));

// Module-level fields
export const MODULE_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Module Name', type: 'string', required: true, placeholder: 'mymodule' },
  { key: 'buildsystem', label: 'Build System', type: 'enum', enum: ['autotools', 'cmake', 'cmake-ninja', 'meson', 'simple', 'qmake'], description: 'Build system to use' },
  { key: 'subdir', label: 'Subdirectory', type: 'string', description: 'Build in this subdirectory' },
  { key: 'config-opts', label: 'Config Options', type: 'string-array', description: 'Options to pass to the configure step' },
  { key: 'build-commands', label: 'Build Commands', type: 'string-array', description: 'Commands to run during build (simple buildsystem)' },
  { key: 'post-install', label: 'Post-Install Commands', type: 'string-array', description: 'Commands to run after install' },
  { key: 'make-args', label: 'Make Args', type: 'string-array', description: 'Arguments to pass to make' },
  { key: 'make-install-args', label: 'Make Install Args', type: 'string-array', description: 'Arguments to pass to make install' },
  { key: 'cleanup', label: 'Cleanup', type: 'string-array', description: 'Files/directories to remove from this module' },
  { key: 'no-autogen', label: 'No Autogen', type: 'boolean', description: 'Skip the autogen step' },
  { key: 'no-parallel-make', label: 'No Parallel Make', type: 'boolean', description: 'Disable parallel make' },
  { key: 'no-make-install', label: 'No Make Install', type: 'boolean', description: 'Skip make install' },
  { key: 'rm-configure', label: 'Remove Configure', type: 'boolean', description: 'Remove the configure script before building' },
  { key: 'builddir', label: 'Build in Separate Dir', type: 'boolean', description: 'Build in a separate directory' },
  { key: 'disabled', label: 'Disabled', type: 'boolean', description: 'Skip building this module' },
  { key: 'only-arches', label: 'Only Architectures', type: 'string-array', description: 'Only build on these architectures' },
  { key: 'skip-arches', label: 'Skip Architectures', type: 'string-array', description: 'Skip building on these architectures' },
];

// Source type definitions
export const SOURCE_TYPES: ModuleSourceDef[] = [
  {
    type: 'archive',
    label: 'Archive',
    fields: [
      { key: 'url', label: 'URL', type: 'string', required: true, placeholder: 'https://example.org/app-1.0.tar.gz' },
      { key: 'sha256', label: 'SHA256', type: 'string', description: 'SHA256 checksum', placeholder: '...' },
      { key: 'sha512', label: 'SHA512', type: 'string' },
      { key: 'md5', label: 'MD5', type: 'string' },
      { key: 'dest-filename', label: 'Dest Filename', type: 'string' },
      { key: 'strip-components', label: 'Strip Components', type: 'number' },
      { key: 'archive-type', label: 'Archive Type', type: 'enum', enum: ['rpm', 'tar', 'tar-gzip', 'tar-compress', 'tar-bzip2', 'tar-lzip', 'tar-lzma', 'tar-lzop', 'tar-xz', 'tar-zst', 'zip', '7z'] },
      { key: 'mirror-urls', label: 'Mirror URLs', type: 'string-array' },
      { key: 'git-init', label: 'Git Init', type: 'boolean' },
    ],
  },
  {
    type: 'git',
    label: 'Git',
    fields: [
      { key: 'url', label: 'URL', type: 'string', required: true, placeholder: 'https://github.com/user/repo.git' },
      { key: 'branch', label: 'Branch', type: 'string' },
      { key: 'tag', label: 'Tag', type: 'string' },
      { key: 'commit', label: 'Commit', type: 'string', placeholder: 'Full commit hash' },
      { key: 'disable-shallow-clone', label: 'Disable Shallow Clone', type: 'boolean' },
      { key: 'disable-submodules', label: 'Disable Submodules', type: 'boolean' },
    ],
  },
  {
    type: 'file',
    label: 'File',
    fields: [
      { key: 'url', label: 'URL', type: 'string', placeholder: 'https://example.org/file.txt' },
      { key: 'path', label: 'Local Path', type: 'string' },
      { key: 'sha256', label: 'SHA256', type: 'string' },
      { key: 'dest-filename', label: 'Dest Filename', type: 'string' },
      { key: 'mirror-urls', label: 'Mirror URLs', type: 'string-array' },
    ],
  },
  {
    type: 'dir',
    label: 'Directory',
    fields: [
      { key: 'path', label: 'Path', type: 'string', required: true },
      { key: 'skip', label: 'Skip Patterns', type: 'string-array' },
    ],
  },
  {
    type: 'script',
    label: 'Script',
    fields: [
      { key: 'commands', label: 'Commands', type: 'string-array', required: true },
      { key: 'dest-filename', label: 'Dest Filename', type: 'string' },
    ],
  },
  {
    type: 'shell',
    label: 'Shell',
    fields: [
      { key: 'commands', label: 'Commands', type: 'string-array', required: true },
    ],
  },
  {
    type: 'patch',
    label: 'Patch',
    fields: [
      { key: 'path', label: 'Patch File Path', type: 'string' },
      { key: 'paths', label: 'Patch File Paths', type: 'string-array' },
      { key: 'strip-components', label: 'Strip Components', type: 'number' },
      { key: 'use-git', label: 'Use Git Apply', type: 'boolean' },
      { key: 'use-git-am', label: 'Use Git Am', type: 'boolean' },
    ],
  },
  {
    type: 'extra-data',
    label: 'Extra Data',
    fields: [
      { key: 'filename', label: 'Filename', type: 'string', required: true },
      { key: 'url', label: 'URL', type: 'string', required: true },
      { key: 'sha256', label: 'SHA256', type: 'string', required: true },
      { key: 'size', label: 'Size (bytes)', type: 'number', required: true },
      { key: 'installed-size', label: 'Installed Size', type: 'number' },
    ],
  },
  {
    type: 'inline',
    label: 'Inline Data',
    fields: [
      { key: 'contents', label: 'Contents', type: 'string', required: true },
      { key: 'dest-filename', label: 'Dest Filename', type: 'string', required: true },
    ],
  },
];

// Manifest type (loose enough for form manipulation)
export type ManifestModule = {
  name: string;
  buildsystem?: string;
  sources?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export type Manifest = {
  id?: string;
  'app-id'?: string;
  runtime?: string;
  'runtime-version'?: string;
  sdk?: string;
  command?: string;
  modules?: ManifestModule[];
  'finish-args'?: string[];
  [key: string]: unknown;
};

// Normalize manifest: convert app-id to id
export function normalizeManifest(m: Record<string, unknown>): Manifest {
  const result = { ...m } as Manifest;
  if (result['app-id'] && !result.id) {
    result.id = result['app-id'] as string;
    delete result['app-id'];
  }
  return result;
}

// Get the effective app ID from a manifest
export function getManifestAppId(m: Manifest): string {
  return (m.id || m['app-id'] || '') as string;
}

// Validate required fields, returns array of missing field labels
export function validateRequired(m: Manifest): string[] {
  const missing: string[] = [];
  for (const f of REQUIRED_FIELDS) {
    const val = m[f.key];
    if (!val || (typeof val === 'string' && !val.trim())) {
      missing.push(f.label);
    }
  }
  if (!m.modules || !Array.isArray(m.modules) || m.modules.length === 0) {
    missing.push('Modules (at least one)');
  }
  return missing;
}

// Create a blank manifest with defaults
export function createBlankManifest(appId: string): Manifest {
  return {
    id: appId,
    runtime: '',
    'runtime-version': '',
    sdk: '',
    command: '',
    modules: [
      {
        name: '',
        buildsystem: 'simple',
        'build-commands': [],
        sources: [],
      },
    ],
  };
}
