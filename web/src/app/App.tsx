import { BrowserRouter } from 'react-router';
import type { Container } from '../composition/container';
import { AppProviders } from './appProviders';
import { AppRoutes } from './routes';

/** The app: the providers, the browser's address bar and the routes. */
export function App({ container }: { container: Container }) {
  return (
    <AppProviders container={container}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  );
}
