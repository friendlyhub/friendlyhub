// AppStream metainfo helpers for the dual-pane editor

export interface DescriptionBlock {
  type: 'p' | 'ul' | 'ol';
  content: string; // for p: paragraph text; for ul/ol: newline-separated list items
}

export interface MetainfoData {
  id: string;
  metadata_license: string;
  project_license: string;
  name: string;
  summary: string;
  description: DescriptionBlock[];
  developer_id: string;
  developer_name: string;
  screenshots: { image: string; caption: string; isDefault: boolean }[];
  urls: { type: string; value: string }[];
  content_rating_type: string;
  releases: { version: string; date: string; description: DescriptionBlock[] }[];
  launchable: string;
  categories: string[];
  keywords: string[];
  provides_binaries: string[];
  branding_colors: { value: string; scheme: 'light' | 'dark' }[];
  component_type: string;
}

export const METADATA_LICENSES = [
  'CC0-1.0',
  'FSFAP',
  'MIT',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'CC-BY-SA-3.0',
  'CC-BY-SA-4.0',
];

export const COMPONENT_TYPES = [
  'desktop-application',
  'console-application',
  'addon',
  'runtime',
];

export const URL_TYPES = [
  { type: 'homepage', label: 'Homepage', required: true },
  { type: 'bugtracker', label: 'Bug Tracker', required: false },
  { type: 'vcs-browser', label: 'VCS Browser', required: false },
  { type: 'donation', label: 'Donation', required: false },
  { type: 'contact', label: 'Contact', required: false },
  { type: 'faq', label: 'FAQ', required: false },
  { type: 'translate', label: 'Translate', required: false },
  { type: 'contribute', label: 'Contribute', required: false },
];

export interface ValidationMessage {
  severity: 'error' | 'warning' | 'info';
  field: string; // category for grouping
  message: string;
}

export function createBlankMetainfo(appId: string): MetainfoData {
  return {
    id: appId,
    metadata_license: 'CC0-1.0',
    project_license: '',
    name: '',
    summary: '',
    description: [{ type: 'p', content: '' }],
    developer_id: '',
    developer_name: '',
    screenshots: [],
    urls: [{ type: 'homepage', value: '' }],
    content_rating_type: 'oars-1.1',
    releases: [{ version: '', date: '', description: [{ type: 'p', content: '' }] }],
    launchable: '',
    categories: [],
    keywords: [],
    provides_binaries: [],
    branding_colors: [],
    component_type: 'desktop-application',
  };
}

function hasContent(blocks: DescriptionBlock[]): boolean {
  return blocks.some(b => b.content.trim());
}

export function validateMetainfo(data: MetainfoData, expectedAppId: string): ValidationMessage[] {
  const msgs: ValidationMessage[] = [];

  // ID
  if (!data.id.trim()) {
    msgs.push({ severity: 'error', field: 'ID', message: 'ID is required' });
  } else if (data.id !== expectedAppId) {
    msgs.push({ severity: 'error', field: 'ID', message: `ID must match app ID (${expectedAppId})` });
  }
  if (data.id.endsWith('.desktop')) {
    msgs.push({ severity: 'error', field: 'ID', message: 'ID must not include .desktop suffix' });
  }

  // Licenses
  if (!data.metadata_license.trim()) {
    msgs.push({ severity: 'error', field: 'Licenses', message: 'Metadata license is required' });
  }
  if (!data.project_license.trim()) {
    msgs.push({ severity: 'error', field: 'Licenses', message: 'Project license is required' });
  }

  // Name & summary
  if (!data.name.trim()) {
    msgs.push({ severity: 'error', field: 'Name & Summary', message: 'Name is required' });
  }
  if (!data.summary.trim()) {
    msgs.push({ severity: 'error', field: 'Name & Summary', message: 'Summary is required' });
  }

  // Description
  if (!hasContent(data.description)) {
    msgs.push({ severity: 'error', field: 'Description', message: 'Description must contain at least one paragraph or list' });
  }

  // Developer
  if (!data.developer_name.trim()) {
    msgs.push({ severity: 'error', field: 'Developer', message: 'Developer name is required' });
  }
  if (!data.developer_id.trim()) {
    msgs.push({ severity: 'warning', field: 'Developer', message: 'Developer ID (reverse-DNS) is recommended' });
  }

  // Content rating
  if (!data.content_rating_type.trim()) {
    msgs.push({ severity: 'error', field: 'Content Rating', message: 'Content rating is required (use oars-1.1)' });
  }

  // Releases
  if (data.releases.length === 0) {
    msgs.push({ severity: 'error', field: 'Releases', message: 'At least one release is required' });
  } else {
    for (let i = 0; i < data.releases.length; i++) {
      const r = data.releases[i];
      if (!r.version.trim()) {
        msgs.push({ severity: 'error', field: 'Releases', message: `Release ${i + 1}: version is required` });
      }
      if (!r.date.trim()) {
        msgs.push({ severity: 'error', field: 'Releases', message: `Release ${i + 1}: date is required` });
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
        msgs.push({ severity: 'error', field: 'Releases', message: `Release ${i + 1}: date must be YYYY-MM-DD format` });
      } else {
        const releaseDate = new Date(r.date);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (releaseDate > today) {
          msgs.push({ severity: 'warning', field: 'Releases', message: `Release ${i + 1}: date is in the future` });
        }
      }
    }
  }

  // URLs
  const hasHomepage = data.urls.some(u => u.type === 'homepage' && u.value.trim());
  if (!hasHomepage) {
    msgs.push({ severity: 'error', field: 'URLs', message: 'Homepage URL is required' });
  }
  const hasVcs = data.urls.some(u => u.type === 'vcs-browser' && u.value.trim());
  if (!hasVcs) {
    msgs.push({ severity: 'info', field: 'URLs', message: 'VCS browser URL is recommended for open-source apps' });
  }
  const hasBugtracker = data.urls.some(u => u.type === 'bugtracker' && u.value.trim());
  if (!hasBugtracker) {
    msgs.push({ severity: 'info', field: 'URLs', message: 'Bug tracker URL is recommended' });
  }

  // Screenshots
  if (data.component_type === 'desktop-application' && data.screenshots.length === 0) {
    msgs.push({ severity: 'warning', field: 'Screenshots', message: 'Screenshots are recommended for desktop applications' });
  }
  for (let i = 0; i < data.screenshots.length; i++) {
    const s = data.screenshots[i];
    if (!s.image.trim()) {
      msgs.push({ severity: 'error', field: 'Screenshots', message: `Screenshot ${i + 1}: image URL is required` });
    } else if (/^https?:\/\/github\.com\//.test(s.image) && !s.image.startsWith('https://raw.githubusercontent.com/')) {
      msgs.push({ severity: 'warning', field: 'Screenshots', message: `Screenshot ${i + 1}: use raw.githubusercontent.com for GitHub images (the blob URL won't work)` });
    }
  }

  // Launchable
  if (data.component_type === 'desktop-application' && !data.launchable.trim()) {
    msgs.push({ severity: 'info', field: 'Optional', message: 'Launchable (desktop-id) is recommended for desktop apps' });
  }

  return msgs;
}

// Get latest version from releases
export function getLatestVersion(data: MetainfoData): string {
  if (data.releases.length === 0) return '';
  return data.releases[0].version; // first release in XML order is newest
}

// Escape XML special characters
function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Unescape XML entities
function unescXml(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function serializeDescriptionBlocks(blocks: DescriptionBlock[], indent: string): string[] {
  const lines: string[] = [];
  for (const block of blocks) {
    if (!block.content.trim()) continue;
    if (block.type === 'p') {
      lines.push(`${indent}<p>${escXml(block.content.trim())}</p>`);
    } else {
      const tag = block.type;
      const items = block.content.split('\n').filter(l => l.trim());
      if (items.length > 0) {
        lines.push(`${indent}<${tag}>`);
        for (const item of items) {
          lines.push(`${indent}  <li>${escXml(item.trim())}</li>`);
        }
        lines.push(`${indent}</${tag}>`);
      }
    }
  }
  return lines;
}

export function serializeMetainfo(data: MetainfoData): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<component type="${escXml(data.component_type)}">`);
  lines.push(`  <id>${escXml(data.id)}</id>`);
  lines.push(`  <metadata_license>${escXml(data.metadata_license)}</metadata_license>`);
  lines.push(`  <project_license>${escXml(data.project_license)}</project_license>`);
  lines.push(`  <name>${escXml(data.name)}</name>`);
  lines.push(`  <summary>${escXml(data.summary)}</summary>`);

  // Description
  if (hasContent(data.description)) {
    lines.push('  <description>');
    lines.push(...serializeDescriptionBlocks(data.description, '    '));
    lines.push('  </description>');
  }

  // Developer
  if (data.developer_name.trim()) {
    if (data.developer_id.trim()) {
      lines.push(`  <developer id="${escXml(data.developer_id)}">`);
    } else {
      lines.push('  <developer>');
    }
    lines.push(`    <name>${escXml(data.developer_name)}</name>`);
    lines.push('  </developer>');
  }

  // Launchable
  if (data.launchable.trim()) {
    lines.push(`  <launchable type="desktop-id">${escXml(data.launchable)}</launchable>`);
  }

  // Screenshots
  if (data.screenshots.length > 0) {
    lines.push('  <screenshots>');
    for (const s of data.screenshots) {
      if (!s.image.trim()) continue;
      const typeAttr = s.isDefault ? ' type="default"' : '';
      lines.push(`    <screenshot${typeAttr}>`);
      lines.push(`      <image>${escXml(s.image)}</image>`);
      if (s.caption.trim()) {
        lines.push(`      <caption>${escXml(s.caption)}</caption>`);
      }
      lines.push('    </screenshot>');
    }
    lines.push('  </screenshots>');
  }

  // URLs
  for (const u of data.urls) {
    if (u.value.trim()) {
      lines.push(`  <url type="${escXml(u.type)}">${escXml(u.value)}</url>`);
    }
  }

  // Categories
  if (data.categories.length > 0) {
    lines.push('  <categories>');
    for (const c of data.categories) {
      if (c.trim()) lines.push(`    <category>${escXml(c)}</category>`);
    }
    lines.push('  </categories>');
  }

  // Keywords
  if (data.keywords.length > 0) {
    lines.push('  <keywords>');
    for (const k of data.keywords) {
      if (k.trim()) lines.push(`    <keyword>${escXml(k)}</keyword>`);
    }
    lines.push('  </keywords>');
  }

  // Provides
  if (data.provides_binaries.length > 0) {
    lines.push('  <provides>');
    for (const b of data.provides_binaries) {
      if (b.trim()) lines.push(`    <binary>${escXml(b)}</binary>`);
    }
    lines.push('  </provides>');
  }

  // Branding
  if (data.branding_colors.length > 0) {
    lines.push('  <branding>');
    for (const c of data.branding_colors) {
      lines.push(`    <color type="primary" scheme_preference="${c.scheme}">${escXml(c.value)}</color>`);
    }
    lines.push('  </branding>');
  }

  // Content rating
  lines.push(`  <content_rating type="${escXml(data.content_rating_type)}" />`);

  // Releases
  if (data.releases.length > 0) {
    lines.push('  <releases>');
    for (const r of data.releases) {
      const versionAttr = r.version.trim() ? ` version="${escXml(r.version)}"` : '';
      const dateAttr = r.date.trim() ? ` date="${escXml(r.date)}"` : '';
      const descLines = serializeDescriptionBlocks(r.description, '        ');
      if (descLines.length > 0) {
        lines.push(`    <release${versionAttr}${dateAttr}>`);
        lines.push('      <description>');
        lines.push(...descLines);
        lines.push('      </description>');
        lines.push('    </release>');
      } else {
        lines.push(`    <release${versionAttr}${dateAttr} />`);
      }
    }
    lines.push('  </releases>');
  }

  lines.push('</component>');
  return lines.join('\n');
}

function getChildText(el: Element, tagName: string): string {
  const child = el.getElementsByTagName(tagName)[0];
  return child ? unescXml(child.textContent || '').trim() : '';
}

function getChildrenText(el: Element, tagName: string): string[] {
  const children = el.getElementsByTagName(tagName);
  return Array.from(children).map(c => unescXml(c.textContent || '').trim());
}

function parseDescriptionBlocks(descEl: Element): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  for (const child of Array.from(descEl.children)) {
    if (child.tagName === 'p') {
      blocks.push({ type: 'p', content: unescXml(child.textContent || '').trim() });
    } else if (child.tagName === 'ul' || child.tagName === 'ol') {
      const items = Array.from(child.getElementsByTagName('li'))
        .map(li => unescXml(li.textContent || '').trim());
      blocks.push({ type: child.tagName as 'ul' | 'ol', content: items.join('\n') });
    }
  }
  return blocks.length > 0 ? blocks : [{ type: 'p', content: '' }];
}

export function parseMetainfo(xml: string): MetainfoData | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) return null;

    const component = doc.documentElement;
    if (component.tagName !== 'component') return null;

    const component_type = component.getAttribute('type') || 'desktop-application';

    // Description - only the top-level description (not inside releases)
    const descEl = Array.from(component.children).find(c => c.tagName === 'description');
    const description = descEl ? parseDescriptionBlocks(descEl) : [{ type: 'p' as const, content: '' }];

    // Developer
    const devEl = component.getElementsByTagName('developer')[0];
    const developer_id = devEl?.getAttribute('id') || '';
    const developer_name = devEl ? getChildText(devEl, 'name') : '';

    // Screenshots
    const screenshotsEl = component.getElementsByTagName('screenshots')[0];
    const screenshots: MetainfoData['screenshots'] = [];
    if (screenshotsEl) {
      const shotEls = screenshotsEl.getElementsByTagName('screenshot');
      for (const s of Array.from(shotEls)) {
        screenshots.push({
          image: getChildText(s, 'image'),
          caption: getChildText(s, 'caption'),
          isDefault: s.getAttribute('type') === 'default',
        });
      }
    }

    // URLs
    const urlEls = component.querySelectorAll(':scope > url');
    const urls: MetainfoData['urls'] = [];
    for (const u of Array.from(urlEls)) {
      urls.push({
        type: u.getAttribute('type') || 'homepage',
        value: unescXml(u.textContent || '').trim(),
      });
    }
    if (urls.length === 0) {
      urls.push({ type: 'homepage', value: '' });
    }

    // Categories
    const catEl = component.getElementsByTagName('categories')[0];
    const categories = catEl ? getChildrenText(catEl, 'category') : [];

    // Keywords
    const kwEl = component.getElementsByTagName('keywords')[0];
    const keywords = kwEl ? getChildrenText(kwEl, 'keyword') : [];

    // Provides
    const provEl = component.getElementsByTagName('provides')[0];
    const provides_binaries = provEl ? getChildrenText(provEl, 'binary') : [];

    // Branding
    const brandEl = component.getElementsByTagName('branding')[0];
    const branding_colors: MetainfoData['branding_colors'] = [];
    if (brandEl) {
      const colorEls = brandEl.getElementsByTagName('color');
      for (const c of Array.from(colorEls)) {
        branding_colors.push({
          value: unescXml(c.textContent || '').trim(),
          scheme: (c.getAttribute('scheme_preference') || 'light') as 'light' | 'dark',
        });
      }
    }

    // Content rating
    const crEl = component.getElementsByTagName('content_rating')[0];
    const content_rating_type = crEl?.getAttribute('type') || 'oars-1.1';

    // Releases
    const releasesEl = component.getElementsByTagName('releases')[0];
    const releases: MetainfoData['releases'] = [];
    if (releasesEl) {
      const relEls = releasesEl.getElementsByTagName('release');
      for (const r of Array.from(relEls)) {
        const relDescEl = r.getElementsByTagName('description')[0];
        const relDesc = relDescEl
          ? parseDescriptionBlocks(relDescEl)
          : [{ type: 'p' as const, content: '' }];
        releases.push({
          version: r.getAttribute('version') || '',
          date: r.getAttribute('date') || '',
          description: relDesc,
        });
      }
    }

    // Launchable
    const launchEl = component.getElementsByTagName('launchable')[0];
    const launchable = launchEl ? unescXml(launchEl.textContent || '').trim() : '';

    return {
      id: getChildText(component, 'id'),
      metadata_license: getChildText(component, 'metadata_license'),
      project_license: getChildText(component, 'project_license'),
      name: getChildText(component, 'name'),
      summary: getChildText(component, 'summary'),
      description,
      developer_id,
      developer_name,
      screenshots,
      urls,
      content_rating_type,
      releases,
      launchable,
      categories,
      keywords,
      provides_binaries,
      branding_colors,
      component_type,
    };
  } catch {
    return null;
  }
}

// Extract external source file names from a manifest
export function getExternalSourceFiles(manifest: Record<string, unknown>): string[] {
  const files: string[] = [];
  const modules = manifest.modules as Array<unknown> | undefined;
  if (!Array.isArray(modules)) return files;

  for (const mod of modules) {
    if (typeof mod !== 'object' || mod === null) continue;
    const sources = (mod as Record<string, unknown>).sources as Array<unknown> | undefined;
    if (!Array.isArray(sources)) continue;
    for (const src of sources) {
      if (typeof src === 'string' && !src.startsWith('/') && !src.startsWith('http')) {
        files.push(src);
      }
    }
  }
  return files;
}
