import { siUbuntu, siFedora, siDebian, siArchlinux, siLinuxmint, siOpensuse,
  siManjaro, siPopos, siZorin, siElementary, siSolus, siVoidlinux,
  siGentoo, siNixos, siCentos, siRockylinux, siAlmalinux, siGooglechrome,
} from 'simple-icons';

export interface Distro {
  name: string;
  slug: string;
  path: string;
  hex: string;
  markdown: () => Promise<string>;
}

const distros: Distro[] = [
  { name: 'Ubuntu', slug: 'ubuntu', path: siUbuntu.path, hex: siUbuntu.hex, markdown: () => import('./ubuntu.md?raw').then(m => m.default) },
  { name: 'Fedora', slug: 'fedora', path: siFedora.path, hex: siFedora.hex, markdown: () => import('./fedora.md?raw').then(m => m.default) },
  { name: 'Debian', slug: 'debian', path: siDebian.path, hex: siDebian.hex, markdown: () => import('./debian.md?raw').then(m => m.default) },
  { name: 'Arch Linux', slug: 'arch-linux', path: siArchlinux.path, hex: siArchlinux.hex, markdown: () => import('./arch-linux.md?raw').then(m => m.default) },
  { name: 'Linux Mint', slug: 'linux-mint', path: siLinuxmint.path, hex: siLinuxmint.hex, markdown: () => import('./linux-mint.md?raw').then(m => m.default) },
  { name: 'openSUSE', slug: 'opensuse', path: siOpensuse.path, hex: siOpensuse.hex, markdown: () => import('./opensuse.md?raw').then(m => m.default) },
  { name: 'Manjaro', slug: 'manjaro', path: siManjaro.path, hex: siManjaro.hex, markdown: () => import('./manjaro.md?raw').then(m => m.default) },
  { name: 'Pop!_OS', slug: 'pop-os', path: siPopos.path, hex: siPopos.hex, markdown: () => import('./pop-os.md?raw').then(m => m.default) },
  { name: 'Zorin OS', slug: 'zorin-os', path: siZorin.path, hex: siZorin.hex, markdown: () => import('./zorin-os.md?raw').then(m => m.default) },
  { name: 'elementary OS', slug: 'elementary-os', path: siElementary.path, hex: siElementary.hex, markdown: () => import('./elementary-os.md?raw').then(m => m.default) },
  { name: 'Solus', slug: 'solus', path: siSolus.path, hex: siSolus.hex, markdown: () => import('./solus.md?raw').then(m => m.default) },
  { name: 'Void Linux', slug: 'void-linux', path: siVoidlinux.path, hex: siVoidlinux.hex, markdown: () => import('./void-linux.md?raw').then(m => m.default) },
  { name: 'Gentoo', slug: 'gentoo', path: siGentoo.path, hex: siGentoo.hex, markdown: () => import('./gentoo.md?raw').then(m => m.default) },
  { name: 'NixOS', slug: 'nixos', path: siNixos.path, hex: siNixos.hex, markdown: () => import('./nixos.md?raw').then(m => m.default) },
  { name: 'CentOS Stream', slug: 'centos-stream', path: siCentos.path, hex: siCentos.hex, markdown: () => import('./centos-stream.md?raw').then(m => m.default) },
  { name: 'Rocky Linux', slug: 'rocky-linux', path: siRockylinux.path, hex: siRockylinux.hex, markdown: () => import('./rocky-linux.md?raw').then(m => m.default) },
  { name: 'AlmaLinux', slug: 'alma-linux', path: siAlmalinux.path, hex: siAlmalinux.hex, markdown: () => import('./alma-linux.md?raw').then(m => m.default) },
  { name: 'ChromeOS', slug: 'chrome-os', path: siGooglechrome.path, hex: siGooglechrome.hex, markdown: () => import('./chrome-os.md?raw').then(m => m.default) },
];

export default distros;

export function getDistroBySlug(slug: string): Distro | undefined {
  return distros.find(d => d.slug === slug);
}
