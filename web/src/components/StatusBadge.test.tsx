import { render, screen } from '@testing-library/react';
import StatusBadge from './StatusBadge';

describe('StatusBadge', () => {
  it('renders known status with friendly label', () => {
    render(<StatusBadge status="pending_review" />);
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
  });

  it('renders "Published" for published status', () => {
    render(<StatusBadge status="published" />);
    expect(screen.getByText('Published')).toBeInTheDocument();
  });

  it('falls back to raw status for unknown values', () => {
    render(<StatusBadge status="some_weird_status" />);
    expect(screen.getByText('some_weird_status')).toBeInTheDocument();
  });

  it('applies correct color classes for build_failed', () => {
    const { container } = render(<StatusBadge status="build_failed" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-red-100');
    expect(badge.className).toContain('text-red-800');
  });

  it('applies gray fallback for unknown status', () => {
    const { container } = render(<StatusBadge status="unknown" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-gray-100');
  });

  it('renders all known statuses without crashing', () => {
    const statuses = [
      'pending_build', 'building', 'build_failed',
      'pending_review', 'approved', 'changes_requested', 'published',
    ];
    for (const status of statuses) {
      const { unmount } = render(<StatusBadge status={status} />);
      unmount();
    }
  });
});
