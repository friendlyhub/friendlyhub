import { validateManifest, type Manifest } from './manifest';

function manifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    id: 'org.example.TestApp',
    runtime: 'org.freedesktop.Platform',
    'runtime-version': '24.08',
    sdk: 'org.freedesktop.Sdk',
    command: 'test-app',
    modules: [{ name: 'test-app' }],
    'finish-args': ['--share=ipc', '--socket=wayland'],
    ...overrides,
  };
}

describe('validateManifest', () => {
  it('returns nothing for a clean manifest', () => {
    expect(validateManifest(manifest())).toEqual([]);
  });

  it('warns when runtime-version is missing', () => {
    const messages = validateManifest(manifest({ 'runtime-version': undefined }));
    expect(messages).toHaveLength(1);
    expect(messages[0].severity).toBe('warning');
    expect(messages[0].message).toContain('No runtime-version specified');
  });

  it('warns when finish-args is empty', () => {
    const messages = validateManifest(manifest({ 'finish-args': [] }));
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain('app will have no permissions');
  });

  it('warns for each sensitive permission', () => {
    const messages = validateManifest(
      manifest({ 'finish-args': ['--share=ipc', '--device=all', '--filesystem=host'] })
    );
    expect(messages).toHaveLength(2);
    expect(messages[0].message).toBe(
      '--device=all — Allows the app to access nearly all hardware devices.'
    );
    expect(messages[1].message).toContain('--filesystem=host');
  });

  it('does not warn for caution-rated permissions', () => {
    // --share=network is caution, not sensitive: warning on it would flag
    // most apps in the repo for nothing.
    expect(validateManifest(manifest({ 'finish-args': ['--share=network'] }))).toEqual([]);
  });

  it('files permission warnings under the Permissions field', () => {
    const messages = validateManifest(manifest({ 'finish-args': ['--device=all'] }));
    expect(messages[0].field).toBe('Permissions');
  });
});
