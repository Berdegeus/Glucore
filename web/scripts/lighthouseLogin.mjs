// Lighthouse run for RSP-11 (accessibility >= 90 on the login page and the
// patient dashboard), measured on the production build served by `vite preview`.
//
// Why a script and not `lhci collect`: the dashboard needs a session, and the
// token lives in `sessionStorage` (ACC-12), which belongs to one tab. `lhci
// collect` hands each URL to Lighthouse in a fresh tab, so a login done in a
// `puppeteerScript` would not reach the measured page. This script logs in
// through the real login form against a running local backend and lets
// Lighthouse measure the dashboard in that same tab. It writes the results
// where `lhci assert` reads them (`.lighthouseci/lhr-*.json`), and
// `npm run lighthouse` then applies the assertions of `lighthouserc.json`.
//
// Needs: the gateway, auth-service and glucose-service running (the build
// calls `VITE_API_URL`), a local patient account in LH_EMAIL and LH_PASSWORD,
// and Chrome installed (or its path in CHROME_PATH).

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer-core';

const webRoot = resolve(import.meta.dirname, '..');
const reportDir = join(webRoot, '.lighthouseci');
const config = JSON.parse(readFileSync(join(webRoot, 'lighthouserc.json'), 'utf8'));
const [loginUrl, dashboardUrl] = config.ci.collect.url;
const SERVER_TIMEOUT_MS = 30_000;
const LOGIN_TIMEOUT_MS = 30_000;

function credentials() {
  const email = process.env.LH_EMAIL;
  const password = process.env.LH_PASSWORD;
  if (!email || !password) throw new Error('Set LH_EMAIL and LH_PASSWORD to a local patient account (see web/README.md).');
  return { email, password };
}

function startPreview() {
  const port = new URL(loginUrl).port;
  const vite = join(webRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  return spawn(process.execPath, [vite, 'preview', '--port', port, '--strictPort'], { cwd: webRoot, stdio: 'inherit' });
}

async function waitForServer(url) {
  const deadline = Date.now() + SERVER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const ok = await fetch(url).then((response) => response.ok, () => false);
    if (ok) return;
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error(`vite preview did not answer at ${url}; run \`npm run build\` first.`);
}

function launchChrome() {
  const executable = process.env.CHROME_PATH;
  return puppeteer.launch(executable ? { executablePath: executable } : { channel: 'chrome' });
}

function clearReports() {
  mkdirSync(reportDir, { recursive: true });
  for (const file of readdirSync(reportDir)) {
    if (/^lhr-\d+\.(json|html)$/.test(file)) rmSync(join(reportDir, file));
  }
}

let reportCount = 0;

/** Saves a result under the name `lhci assert` looks for. */
function saveReport(result) {
  const base = join(reportDir, `lhr-${Date.now() + reportCount++}`);
  const [json, html] = result.report;
  writeFileSync(`${base}.json`, json);
  writeFileSync(`${base}.html`, html);
}

async function measure(page, url, extraFlags = {}) {
  const flags = { ...config.ci.collect.settings, ...extraFlags, output: ['json', 'html'], logLevel: 'error' };
  const result = await lighthouse(url, flags, undefined, page);
  if (!result) throw new Error(`Lighthouse returned no result for ${url}`);
  if (result.lhr.runtimeError) throw new Error(`Lighthouse failed on ${url}: ${result.lhr.runtimeError.message}`);
  return result;
}

async function signIn(page, { email, password }) {
  await page.goto(loginUrl, { waitUntil: 'networkidle0' });
  await page.type('#login-email', email);
  await page.type('#login-password', password);
  await page.click('button[type="submit"]');
  const home = new URL(dashboardUrl).pathname;
  await page.waitForFunction((path) => window.location.pathname === path, { timeout: LOGIN_TIMEOUT_MS }, home);
}

async function measureDashboard(browser, account) {
  const page = await browser.newPage();
  await signIn(page, account);
  // The same tab keeps the token in sessionStorage; Lighthouse must not wipe it.
  const result = await measure(page, dashboardUrl, { disableStorageReset: true });
  const landed = new URL(result.lhr.finalDisplayedUrl).pathname;
  if (landed !== new URL(dashboardUrl).pathname) throw new Error(`The dashboard run ended on ${landed}: the session did not hold.`);
  return result;
}

async function main() {
  const account = credentials();
  const preview = startPreview();
  let browser;
  try {
    await waitForServer(loginUrl);
    browser = await launchChrome();
    clearReports();
    saveReport(await measure(await browser.newPage(), loginUrl));
    saveReport(await measureDashboard(browser, account));
    console.log(`Lighthouse reports written to ${reportDir}`);
  } finally {
    await browser?.close();
    preview.kill();
  }
}

await main();
