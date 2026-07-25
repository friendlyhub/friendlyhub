import { classifyPermission } from './permissions';

describe('classifyPermission', () => {
  // Mirrored by shared_fixture_matches_frontend in
  // server/src/services/permissions.rs. Both read the same catalog from
  // shared/, so if the two implementations ever drift, one of them fails.
  const cases: Array<[string, string, string]> = [
    ['--share=ipc', 'share-ipc', 'safe'],
    ['--share=network', 'share-network', 'caution'],
    ['--socket=wayland', 'socket-wayland', 'safe'],
    ['--socket=fallback-x11', 'socket-fallback-x11', 'caution'],
    ['--socket=pulseaudio', 'socket-pulseaudio', 'caution'],
    ['--socket=session-bus', 'socket-session-bus', 'sensitive'],
    ['--socket=system-bus', 'socket-system-bus', 'sensitive'],
    ['--device=all', 'device-all', 'sensitive'],
    ['--device=dri', 'device-dri', 'safe'],
    ['--filesystem=host', 'filesystem-host', 'sensitive'],
    ['--filesystem=home', 'filesystem-home', 'sensitive'],
    ['--allow=devel', 'allow-devel', 'sensitive'],
  ];

  it.each(cases)('classifies %s as %s/%s', (arg, ruleId, severity) => {
    const result = classifyPermission(arg);
    expect(result.ruleId).toBe(ruleId);
    expect(result.severity).toBe(severity);
  });

  it('trims input', () => {
    expect(classifyPermission('  --device=all  ').ruleId).toBe('device-all');
  });

  it('falls back to caution for unknown permissions', () => {
    const result = classifyPermission('--not-a-real-flag');
    expect(result.ruleId).toBe('unknown');
    expect(result.severity).toBe('caution');
  });

  it('renders the read-only mode suffix', () => {
    expect(classifyPermission('--filesystem=host:ro').description).toMatch(/\(read-only\)\.$/);
  });

  it('renders the create mode suffix', () => {
    expect(classifyPermission('--filesystem=xdg-config/autostart:create').description).toContain(
      'with permission to create it if needed'
    );
  });

  it('renders the path suffix', () => {
    const result = classifyPermission('--filesystem=/var/log');
    expect(result.ruleId).toBe('filesystem-absolute-var');
    expect(result.description).toContain(' at /log');
  });

  it('honours negative lookahead in the /run rule', () => {
    expect(classifyPermission('--filesystem=/run/systemd').ruleId).toBe('filesystem-absolute-run');
    expect(classifyPermission('--filesystem=/run/flatpak').ruleId).not.toBe('filesystem-absolute-run');
  });

  it('picks the higher-priority rule over the generic absolute-path fallback', () => {
    const result = classifyPermission('--filesystem=/sys');
    expect(result.ruleId).toBe('filesystem-absolute-sys');
    expect(result.severity).toBe('sensitive');
  });
});
