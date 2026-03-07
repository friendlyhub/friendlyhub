export const REPO_URL = 'https://dl.friendlyhub.org/repo/';
export const REPO_NAME = 'friendlyhub';
export const FLATPAKREPO_URL = `${REPO_URL}friendlyhub.flatpakrepo`;

/** Relative URL for the server-generated .flatpakref (works through dev proxy). */
export function flatpakrefUrl(appId: string): string {
  return `/api/v1/apps/${appId}/flatpakref`;
}

/** flatpak+https:// URI that triggers GNOME Software / KDE Discover directly. */
export function flatpakInstallUrl(appId: string): string {
  const host = window.location.host;
  return `flatpak+https://${host}/api/v1/apps/${appId}/flatpakref`;
}
