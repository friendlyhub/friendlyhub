import { getExternalSourceFiles } from './metainfo';

describe('getExternalSourceFiles', () => {
  it('finds included module files as well as included sources files', () => {
    // Backtrack's rc3 manifest, trimmed to its modules
    const manifest = {
      id: 'tools.backtrack.Backtrack',
      modules: [
        'python3-requirements.json',
        { name: 'btrfs-progs', sources: [{ type: 'archive', url: 'https://example.org/btrfs-progs.tar.xz' }] },
        {
          name: 'backtrack',
          sources: [
            { type: 'git', url: 'https://github.com/keithvassallomt/backtrack.git', tag: 'v0.1.0-rc3' },
            { type: 'file', path: 'tools.backtrack.Backtrack.metainfo.xml' },
            'cargo-sources.json',
          ],
        },
      ],
    };
    expect(getExternalSourceFiles(manifest)).toEqual(['python3-requirements.json', 'cargo-sources.json']);
  });

  it('finds includes in nested modules', () => {
    const manifest = {
      modules: [{
        name: 'outer',
        modules: [{
          name: 'middle',
          modules: [{ name: 'inner', sources: ['inner-sources.json'], modules: ['inner-module.json'] }],
        }],
      }],
    };
    expect(getExternalSourceFiles(manifest)).toEqual(['inner-sources.json', 'inner-module.json']);
  });

  it('skips shared-modules, absolute paths and URLs', () => {
    const manifest = {
      modules: [
        'shared-modules/libsecret/libsecret.json',
        '/abs/path.json',
        'https://example.org/module.json',
        {
          name: 'app',
          sources: ['shared-modules/foo/foo-sources.json', '/abs/sources.json', 'https://example.org/sources.json'],
        },
      ],
    };
    expect(getExternalSourceFiles(manifest)).toEqual([]);
  });

  it('keeps a local file whose name starts with http', () => {
    expect(getExternalSourceFiles({ modules: ['http-parser.json'] })).toEqual(['http-parser.json']);
  });

  it('lists a file referred to twice once', () => {
    const manifest = {
      modules: [
        { name: 'a', sources: ['cargo-sources.json'] },
        { name: 'b', sources: ['./cargo-sources.json'] },
      ],
    };
    expect(getExternalSourceFiles(manifest)).toEqual(['cargo-sources.json']);
  });

  it('finds the local files of file, patch and archive sources, but not the metainfo', () => {
    const manifest = {
      id: 'org.example.App',
      modules: [{
        name: 'app',
        sources: [
          { type: 'file', path: 'org.example.App.desktop' },
          { type: 'file', path: 'org.example.App.metainfo.xml' },
          { type: 'patch', path: 'patches/one.patch' },
          { type: 'patch', paths: ['patches/two.patch', 'patches/three.patch'] },
          { type: 'archive', path: 'vendor.tar.gz' },
          { type: 'git', path: 'local-checkout' },
          { type: 'dir', path: 'src' },
          { type: 'file', url: 'https://example.org/data.bin' },
        ],
      }],
    };
    expect(getExternalSourceFiles(manifest)).toEqual([
      'org.example.App.desktop',
      'patches/one.patch',
      'patches/two.patch',
      'patches/three.patch',
      'vendor.tar.gz',
    ]);
  });

  it("resolves an uploaded module file's paths against its own directory", () => {
    const loaded = {
      'deps/foo.json': {
        name: 'foo',
        sources: ['foo-sources.json', { type: 'patch', path: './fix.patch' }],
        modules: ['../shared-modules/libsecret/libsecret.json'],
      },
    };
    expect(getExternalSourceFiles({ modules: ['deps/foo.json'] }, loaded)).toEqual([
      'deps/foo.json',
      'deps/foo-sources.json',
      'deps/fix.patch',
    ]);
  });

  it('finds the includes of an uploaded module file', () => {
    const loaded = {
      'libfoo.json': { name: 'libfoo', sources: ['libfoo-sources.json'], modules: ['libbar.json'] },
    };
    expect(getExternalSourceFiles({ modules: ['libfoo.json'] }, loaded)).toEqual([
      'libfoo.json',
      'libfoo-sources.json',
      'libbar.json',
    ]);
  });
});
