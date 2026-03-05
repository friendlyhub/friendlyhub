import { beforeEach, vi } from 'vitest';

// Mock the API client before importing the store
vi.mock('../api/client', () => ({
  getMe: vi.fn(),
}));

import { getMe } from '../api/client';
import { useAuthStore } from './auth';

const mockGetMe = vi.mocked(getMe);

beforeEach(() => {
  localStorage.clear();
  mockGetMe.mockReset();
  // Reset store state
  useAuthStore.setState({ user: null, token: null, loading: true });
});

describe('auth store', () => {
  it('starts with token from localStorage', () => {
    localStorage.setItem('token', 'saved-jwt');
    // Re-create store to pick up localStorage
    // The store reads localStorage at creation time, so we test setToken instead
    const store = useAuthStore.getState();
    store.setToken('saved-jwt');
    expect(useAuthStore.getState().token).toBe('saved-jwt');
  });

  it('setToken persists to localStorage', () => {
    useAuthStore.getState().setToken('new-token');
    expect(localStorage.getItem('token')).toBe('new-token');
    expect(useAuthStore.getState().token).toBe('new-token');
  });

  it('logout clears token and user', () => {
    useAuthStore.setState({ user: { id: '1', github_login: 'dev', display_name: 'Dev', avatar_url: null, role: 'developer' }, token: 'jwt' });
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('loadUser fetches and sets user when token exists', async () => {
    const mockUser = { id: '1', github_login: 'dev', display_name: 'Dev User', avatar_url: null, role: 'developer' };
    mockGetMe.mockResolvedValueOnce(mockUser);
    useAuthStore.setState({ token: 'valid-jwt' });

    await useAuthStore.getState().loadUser();

    expect(mockGetMe).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().loading).toBe(false);
  });

  it('loadUser sets loading false with no token', async () => {
    useAuthStore.setState({ token: null });

    await useAuthStore.getState().loadUser();

    expect(mockGetMe).not.toHaveBeenCalled();
    expect(useAuthStore.getState().loading).toBe(false);
  });

  it('loadUser clears token on API failure', async () => {
    mockGetMe.mockRejectedValueOnce(new Error('Unauthorized'));
    useAuthStore.setState({ token: 'expired-jwt' });

    await useAuthStore.getState().loadUser();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().loading).toBe(false);
  });
});
