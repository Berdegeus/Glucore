import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { createContainer } from './composition/container';
import { readEnv } from './composition/env';
import './shared/presentation/theme/tokens.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App container={createContainer(readEnv())} />
  </StrictMode>,
);
