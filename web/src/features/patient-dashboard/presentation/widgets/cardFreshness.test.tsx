import { screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { summaryFixture } from '../../../../test/summaryFakes';
import { withTimeZone } from '../../../../test/browserTimeZone';
import { describeSummaryWidget, renderWidget } from '../../../../test/widgetHarness';
import CardFreshness, { cardFreshnessDefinition, CARD_FRESHNESS_TITLE, NO_SYNC_CAUSE } from './cardFreshness';

// The wording is fixed by PAC-13, so the tests spell it out.
const STALE_TEXT = 'Sem dados recentes. Abra o aplicativo para sincronizar.';
const LAST_READING = '2026-08-06T08:05:00.000Z';
const MINUTE_MS = 60_000;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describeSummaryWidget({
  Widget: CardFreshness,
  definition: cardFreshnessDefinition,
  title: CARD_FRESHNESS_TITLE,
  shown: /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/,
  emptyCause: NO_SYNC_CAUSE,
});

/** Freezes the clock `minutesAfter` minutes past the last reading; `ticking` also lets a minute interval run. */
function clockAt(minutesAfter: number, ticking = false) {
  vi.useFakeTimers({ toFake: ticking ? ['Date', 'setInterval', 'clearInterval'] : ['Date'] });
  vi.setSystemTime(Date.parse(LAST_READING) + minutesAfter * MINUTE_MS);
}

describe('card-freshness time (PAC-12)', () => {
  it.each([
    { zone: 'UTC', shown: '06/08/2026 08:05' },
    { zone: 'America/Sao_Paulo', shown: '06/08/2026 05:05' },
  ])('shows the last reading in pt-BR on the clock of $zone', async ({ zone, shown }) => {
    withTimeZone(zone);
    clockAt(5);
    renderWidget(<CardFreshness size="S" />, { summary: summaryFixture({ lastReadingAt: LAST_READING }) });

    expect(await screen.findByText(shown)).toHaveAttribute('datetime', LAST_READING);
  });

  it('shows the time of the last reading even when it falls outside the period', async () => {
    withTimeZone('UTC');
    clockAt(5);
    renderWidget(<CardFreshness size="S" />, { summary: summaryFixture({ lastReadingAt: LAST_READING, byDay: [] }) });

    expect(await screen.findByText('06/08/2026 08:05')).toBeInTheDocument();
  });
});

describe('card-freshness warning (PAC-13)', () => {
  it.each([
    { minutes: 59, stale: false },
    { minutes: 60, stale: false },
    { minutes: 61, stale: true },
  ])('$minutes minutes after the last reading the warning is shown: $stale', async ({ minutes, stale }) => {
    clockAt(minutes);
    renderWidget(<CardFreshness size="S" />, { summary: summaryFixture({ lastReadingAt: LAST_READING }) });

    await screen.findByRole('time');
    expect(screen.queryByText(STALE_TEXT) !== null).toBe(stale);
  });

  it('pairs the warning with an icon hidden from screen readers, so color is never the only cue', async () => {
    clockAt(120);
    renderWidget(<CardFreshness size="S" />, { summary: summaryFixture({ lastReadingAt: LAST_READING }) });

    const warning = await screen.findByText(STALE_TEXT);
    expect(warning.querySelector('[aria-hidden="true"]')?.textContent).toBe('!');
  });

  it('raises the warning by itself when the reading ages past 60 minutes with the page open', async () => {
    clockAt(30, true);
    renderWidget(<CardFreshness size="S" />, { summary: summaryFixture({ lastReadingAt: LAST_READING }) });
    await screen.findByRole('time');
    expect(screen.queryByText(STALE_TEXT)).not.toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(31 * MINUTE_MS));

    expect(screen.getByText(STALE_TEXT)).toBeInTheDocument();
  });
});
