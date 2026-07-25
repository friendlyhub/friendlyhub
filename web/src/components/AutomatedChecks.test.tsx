import { render, screen } from '@testing-library/react';
import AutomatedChecks from './AutomatedChecks';
import type { CheckResult } from '../types';

function check(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    check_name: 'manifest_lint',
    status: 'passed',
    message: null,
    details: null,
    ...overrides,
  };
}

describe('AutomatedChecks', () => {
  it('renders nothing when there are no checks', () => {
    const { container } = render(<AutomatedChecks checks={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the flagged permission behind a permissions_audit warning', () => {
    render(
      <AutomatedChecks
        checks={[
          check({
            check_name: 'permissions_audit',
            status: 'warning',
            message: '1 potentially dangerous permission(s) detected',
            details: {
              flagged_permissions: [
                {
                  permission: '--device=all',
                  concern: 'Allows the app to access nearly all hardware devices.',
                },
              ],
            },
          }),
        ]}
      />
    );
    expect(
      screen.getByText('--device=all — Allows the app to access nearly all hardware devices.')
    ).toBeInTheDocument();
  });

  it('shows manifest lint warnings and errors', () => {
    render(
      <AutomatedChecks
        checks={[
          check({
            status: 'failed',
            message: 'Manifest has errors',
            details: {
              errors: ['Missing required field: runtime'],
              warnings: ['No finish-args specified; app will have no permissions'],
            },
          }),
        ]}
      />
    );
    expect(screen.getByText('Missing required field: runtime')).toBeInTheDocument();
    expect(
      screen.getByText('No finish-args specified; app will have no permissions')
    ).toBeInTheDocument();
  });

  it('shows metadata completeness concerns', () => {
    render(
      <AutomatedChecks
        checks={[
          check({
            check_name: 'metadata_completeness',
            status: 'warning',
            details: { concerns: ['No .desktop file reference found'] },
          }),
        ]}
      />
    );
    expect(screen.getByText('No .desktop file reference found')).toBeInTheDocument();
  });

  it('renders a passing check without any findings', () => {
    const { container } = render(<AutomatedChecks checks={[check()]} />);
    expect(screen.getByText('manifest lint')).toBeInTheDocument();
    expect(container.querySelector('ul')).toBeNull();
  });

  it('ignores malformed details rather than crashing', () => {
    render(
      <AutomatedChecks
        checks={[
          check({
            check_name: 'permissions_audit',
            status: 'warning',
            details: { flagged_permissions: [null, 'nope', { concern: 'no permission key' }] },
          }),
        ]}
      />
    );
    expect(screen.getByText('permissions audit')).toBeInTheDocument();
  });
});
