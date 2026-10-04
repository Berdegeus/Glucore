// Architecture rules for web/src (design.md, "Estrutura do frontend").
// Layer patterns are anchored on a `src/` segment rather than the path start,
// so the smoke tests can cruise fixture trees under tests/arch/fixtures/.

const FEATURE_OR_SHARED = '(features/[^/]+/|shared/)';
const DOMAIN = `(^|/)src/${FEATURE_OR_SHARED}domain/`;
const APPLICATION = `(^|/)src/${FEATURE_OR_SHARED}application/`;
const INFRASTRUCTURE = `(^|/)src/${FEATURE_OR_SHARED}infrastructure/`;
// `src/app/` holds the router and providers: it is presentation.
const PRESENTATION = `(^|/)src/(${FEATURE_OR_SHARED}presentation/|app/)`;
// The composition root is the only place that may wire every layer.
const COMPOSITION = '(^|/)src/(composition/|main\\.tsx?$)';

const npmPackages = (...names) => `(^|/)node_modules/(${names.join('|')})/`;
const EXTERNAL = ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-bundled', 'npm-no-pkg', 'npm-unknown', 'core'];

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-no-npm',
      comment: 'domain is pure: no npm package and no Node/DOM module (ARQ-02).',
      severity: 'error',
      from: { path: DOMAIN },
      to: { dependencyTypes: EXTERNAL },
    },
    {
      name: 'domain-no-outer-layers',
      comment: 'domain imports only domain (ARQ-02).',
      severity: 'error',
      from: { path: DOMAIN },
      to: { path: [APPLICATION, INFRASTRUCTURE, PRESENTATION, COMPOSITION] },
    },
    {
      name: 'application-no-outer-layers',
      comment: 'application orchestrates domain ports; adapters and UI are injected (ARQ-03).',
      severity: 'error',
      from: { path: APPLICATION },
      to: { path: [INFRASTRUCTURE, PRESENTATION, COMPOSITION] },
    },
    {
      name: 'application-no-frameworks',
      comment: 'application stays free of React, zod and chart or drag libraries.',
      severity: 'error',
      from: { path: APPLICATION },
      to: { path: npmPackages('react', 'react-dom', 'zod', 'recharts', '@dnd-kit/[^/]+') },
    },
    {
      name: 'infrastructure-no-outer-layers',
      comment: 'adapters implement domain ports and never reach use cases or UI.',
      severity: 'error',
      from: { path: INFRASTRUCTURE },
      to: { path: [APPLICATION, PRESENTATION, COMPOSITION] },
    },
    {
      name: 'infrastructure-no-ui-libraries',
      comment: 'adapters do not render.',
      severity: 'error',
      from: { path: INFRASTRUCTURE },
      to: { path: npmPackages('react', 'react-dom', 'recharts', '@dnd-kit/[^/]+') },
    },
    {
      name: 'presentation-no-infrastructure',
      comment: 'presentation receives adapters through the composition root (ARQ-03).',
      severity: 'error',
      from: { path: PRESENTATION },
      to: { path: INFRASTRUCTURE },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
  },
};
