import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../ErrorBoundary';
import { diagnose } from '../diagnostics';

it('offers a useful recovery without displaying the thrown error', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const diagnostic = vi.spyOn(console, 'warn').mockImplementation(() => {});
  let fail = true;
  function Child() { if (fail) throw new Error('private-test-value'); return <p>Recovered entrance</p>; }
  render(<ErrorBoundary><Child/></ErrorBoundary>);
  expect(screen.getByRole('heading', { name: 'A light went out.' })).toBeInTheDocument();
  expect(screen.queryByText('private-test-value')).not.toBeInTheDocument();
  expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('private-test-value');
  fail = false; fireEvent.click(screen.getByRole('button', { name: /Return to the entrance/ }));
  expect(screen.getByText('Recovered entrance')).toBeInTheDocument();
  consoleError.mockRestore(); diagnostic.mockRestore();
});

it('diagnostics discard unknown metadata and invalid request identifiers', () => {
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const metadata = { stage: 'request' as const, status: 500, requestId: 'private-test-token', secret: 'private-test-value' };
  diagnose('api_failure', metadata);
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/private-test/);
  log.mockRestore();
});
