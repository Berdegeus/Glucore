import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { server } from './server';

// Example of the testing toolkit wired in vitest.config.ts: MSW answers the
// request, Testing Library reads the DOM, axe checks accessibility.

const API = 'http://api.test';

function Greeting() {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    void fetch(`${API}/me`)
      .then((response) => response.json() as Promise<{ fullName: string }>)
      .then((body) => setName(body.fullName));
  }, []);
  return (
    <main>
      <h1>{name ? `Olá, ${name}` : 'Carregando'}</h1>
    </main>
  );
}

describe('testing toolkit', () => {
  it('renders data served by MSW with no axe violation', async () => {
    server.use(http.get(`${API}/me`, () => HttpResponse.json({ fullName: 'Ana' })));
    const { container } = render(<Greeting />);

    expect(await screen.findByRole('heading', { name: 'Olá, Ana' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reports an axe violation when the markup has one', async () => {
    // Plain HTML: the JSX version would already be stopped by jsx-a11y.
    const results = await axe('<main><img src="/chart.png"></main>');
    expect(results.violations.map((v) => v.id)).toContain('image-alt');
  });
});
