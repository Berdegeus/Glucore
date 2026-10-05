import { Link } from 'react-router';

export const NOT_FOUND_TITLE = 'Página não encontrada';
export const NOT_FOUND_LINK = 'Voltar ao início';

/** The answer to a path no route claims; the link leads to `/`, which sends the person to their home or the login. */
export function NotFoundPage() {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>{NOT_FOUND_TITLE}</h1>
      <p>
        <Link to="/">{NOT_FOUND_LINK}</Link>
      </p>
    </main>
  );
}
