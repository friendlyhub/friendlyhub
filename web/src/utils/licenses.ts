import spdxLicenseList from 'spdx-license-list';

interface SpdxEntry {
  name: string;
  url: string;
  osiApproved: boolean;
}

const spdxDb = spdxLicenseList as Record<string, SpdxEntry>;

export interface LicenseInfo {
  name: string;
  spdxId: string | null;
  url: string | null;
  isOpenSource: boolean;
}

/**
 * Resolve a license string (potentially an SPDX identifier) to structured info.
 * Handles exact matches, case-insensitive matches, and common suffixes like "-or-later", "-only".
 */
export function resolveLicense(raw: string | null): LicenseInfo {
  if (!raw) {
    return { name: 'Unknown', spdxId: null, url: null, isOpenSource: false };
  }

  // Try exact match first
  if (spdxDb[raw]) {
    const entry = spdxDb[raw];
    return {
      name: entry.name,
      spdxId: raw,
      url: entry.url,
      isOpenSource: entry.osiApproved,
    };
  }

  // Case-insensitive search
  const lowerRaw = raw.toLowerCase();
  for (const [id, entry] of Object.entries(spdxDb)) {
    if (id.toLowerCase() === lowerRaw) {
      return {
        name: entry.name,
        spdxId: id,
        url: entry.url,
        isOpenSource: entry.osiApproved,
      };
    }
  }

  // Try common SPDX compound expressions: "MIT AND Apache-2.0", "GPL-3.0-or-later OR MIT"
  // For compound licenses, resolve the first one and mark as open source if any part is OSI-approved
  const parts = raw.split(/\s+(?:AND|OR|WITH)\s+/i);
  if (parts.length > 1) {
    const resolved = parts.map((p) => resolveSingle(p.trim()));
    const firstMatch = resolved.find((r) => r.spdxId);
    return {
      name: raw,
      spdxId: firstMatch?.spdxId ?? null,
      url: firstMatch?.url ?? null,
      isOpenSource: resolved.some((r) => r.isOpenSource),
    };
  }

  // Fallback heuristic for common open-source keywords
  const ossKeywords = [
    'GPL', 'LGPL', 'AGPL', 'MIT', 'BSD', 'Apache', 'MPL', 'ISC', 'Artistic',
    'CC-BY', 'CC0', 'Unlicense', 'Zlib', 'PSF', 'WTFPL', 'OFL',
  ];
  const isOss = ossKeywords.some((kw) => raw.toUpperCase().includes(kw.toUpperCase()));

  return {
    name: raw,
    spdxId: null,
    url: null,
    isOpenSource: isOss,
  };
}

function resolveSingle(id: string): LicenseInfo {
  if (spdxDb[id]) {
    const entry = spdxDb[id];
    return { name: entry.name, spdxId: id, url: entry.url, isOpenSource: entry.osiApproved };
  }
  const lower = id.toLowerCase();
  for (const [key, entry] of Object.entries(spdxDb)) {
    if (key.toLowerCase() === lower) {
      return { name: entry.name, spdxId: key, url: entry.url, isOpenSource: entry.osiApproved };
    }
  }
  return { name: id, spdxId: null, url: null, isOpenSource: false };
}
