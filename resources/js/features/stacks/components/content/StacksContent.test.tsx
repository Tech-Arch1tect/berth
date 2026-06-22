import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { StacksContent } from './StacksContent';
import type { Stack } from '../../../../api/generated/models';
import { Server } from '../../../../shared/types/server';

vi.mock('../../../dashboard/components/StackCard', () => ({
  StackCard: ({ stack }: { stack: Stack }) => <div data-testid="stack-card">{stack.name}</div>,
}));

const FULL_SPINNER_TEXT = 'Loading stacks from all servers...';

function stackFixture(name: string, serverId = 1): Stack {
  return { name, server_id: serverId } as Stack;
}

afterEach(cleanup);

type Props = React.ComponentProps<typeof StacksContent>;

function renderContent(overrides: Partial<Props> = {}) {
  const props: Props = {
    stacks: [],
    statistics: { total: 0, healthy: 0, unhealthy: 0, running: 0, totalContainers: 0 },
    layoutMode: 'normal',
    isLoading: false,
    loadingCount: 0,
    hasError: false,
    errors: [],
    hasActiveFilters: false,
    ...overrides,
  };
  return render(<StacksContent {...props} />);
}

describe('StacksContent loading gating', () => {
  it('shows the full-screen spinner only while nothing has loaded yet', () => {
    renderContent({ isLoading: true, loadingCount: 3 });

    expect(screen.getByText(FULL_SPINNER_TEXT)).toBeTruthy();
    expect(screen.queryByTestId('stack-card')).toBeNull();
  });

  it('renders stacks from servers that have responded while others are still loading', () => {
    renderContent({
      isLoading: true,
      loadingCount: 2,
      statistics: { total: 1, healthy: 1, unhealthy: 0, running: 1, totalContainers: 1 },
      stacks: [stackFixture('web')],
    });

    expect(screen.getByTestId('stack-card')).toBeTruthy();
    expect(screen.queryByText(FULL_SPINNER_TEXT)).toBeNull();
    expect(screen.getByText(/Loading stacks from 2 more servers/)).toBeTruthy();
  });

  it('does not show a progress indicator once every server has loaded', () => {
    renderContent({
      isLoading: false,
      loadingCount: 0,
      statistics: { total: 2, healthy: 2, unhealthy: 0, running: 2, totalContainers: 2 },
      stacks: [stackFixture('web'), stackFixture('db')],
    });

    expect(screen.getAllByTestId('stack-card')).toHaveLength(2);
    expect(screen.queryByText(FULL_SPINNER_TEXT)).toBeNull();
    expect(screen.queryByText(/more server/)).toBeNull();
  });

  it('shows the empty state, not the spinner, when a filter excludes all loaded stacks', () => {
    renderContent({
      isLoading: true,
      loadingCount: 1,
      statistics: { total: 5, healthy: 5, unhealthy: 0, running: 5, totalContainers: 5 },
      stacks: [],
      hasActiveFilters: true,
    });

    expect(screen.getByText('No stacks found')).toBeTruthy();
    expect(screen.queryByText(FULL_SPINNER_TEXT)).toBeNull();
    expect(screen.getByText(/Loading stacks from 1 more server/)).toBeTruthy();
  });

  it('surfaces per-server errors alongside the empty state without blocking on a spinner', () => {
    renderContent({
      isLoading: false,
      hasError: true,
      errors: [{ server: { id: 1, name: 'web-1' } as Server, error: new Error('timeout') }],
    });

    expect(screen.getByText('Failed to load stacks from some servers')).toBeTruthy();
    expect(screen.getByText(/web-1: timeout/)).toBeTruthy();
    expect(screen.getByText('No stacks found')).toBeTruthy();
    expect(screen.queryByText(FULL_SPINNER_TEXT)).toBeNull();
  });
});
