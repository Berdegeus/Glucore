import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../composition/container';
import { mockApi } from '../test/apiMocks';
import { TEST_API_URL } from '../test/pageHarness';
import { App } from './App';

afterEach(() => window.history.replaceState(null, '', '/'));

describe('App', () => {
  it('follows the address bar of the browser: an anonymous visitor of / sees the login', async () => {
    mockApi({ role: null });
    const container = createContainer({ apiUrl: TEST_API_URL });
    container.tokenStore.clear();
    window.history.replaceState(null, '', '/');
    render(<App container={container} />);

    expect(await screen.findByRole('heading', { name: 'Entrar no Glucore' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });
});
