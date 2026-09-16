import { describe, expect, it } from 'vitest';
import { formatDuration, formatTimeRemaining } from '../src/index';

const MINUTE = 60;
const HOUR = 3_600;
const DAY = 86_400;

describe('formatDuration', () => {
  it.each([
    [0, 'less than a minute'],
    [29, 'less than a minute'],
    [30, '1 minute'],
    [89, '1 minute'],
    [90, '2 minutes'],
    [60 * MINUTE, '60 minutes'],
    [119 * MINUTE + 29, '119 minutes'],
    [119 * MINUTE + 30, '2 hours'],
    [18 * HOUR, '18 hours'],
    [DAY, '24 hours'],
    [47 * HOUR + 29 * MINUTE, '47 hours'],
    [47 * HOUR + 30 * MINUTE, '2 days'],
    [3 * DAY, '3 days'],
    [365 * DAY, '365 days'],
  ])('spells %i seconds as "%s"', (seconds, words) => {
    expect(formatDuration(seconds)).toBe(words);
  });

  it.each([
    ['a negative span', -5],
    ['an unreadable span', Number.NaN],
  ])('reads %s as less than a minute rather than as a number', (_label, seconds) => {
    expect(formatDuration(seconds)).toBe('less than a minute');
  });

  // The two properties the ladder exists for, checked against an independent
  // reading of the words rather than against the function's own arithmetic.
  const UNIT: Record<string, number> = { minute: MINUTE, hour: HOUR, day: DAY };
  const said = (words: string) => {
    const match = /^(\d+) (minute|hour|day)s?$/.exec(words);
    return match ? Number(match[1]) * (UNIT[match[2]!] as number) : 0;
  };
  const spans = Array.from({ length: (5 * DAY) / 30 + 1 }, (_, step) => step * 30);

  it('never says more time is left as less time is left', () => {
    for (let i = 1; i < spans.length; i++) {
      const shorter = spans[i - 1] as number;
      const longer = spans[i] as number;
      expect(said(formatDuration(shorter))).toBeLessThanOrEqual(said(formatDuration(longer)));
    }
  });

  it('never says "1 hour" or "1 day"', () => {
    const words = new Set(spans.map(formatDuration));
    expect(words.has('1 hour')).toBe(false);
    expect(words.has('1 day')).toBe(false);
  });
});

describe('formatTimeRemaining', () => {
  const NOW = 1_800_000_000;

  it('reads a deployment made a second ago as the lifetime it was given', () => {
    // Truncating said "2 days" here, which is what a table of fresh anonymous
    // deployments must never say about a three-day promise.
    expect(formatTimeRemaining(NOW + 3 * DAY, NOW + 1)).toBe('3 days');
  });

  it('counts from now, so a later look reads less', () => {
    expect(formatTimeRemaining(NOW + 3 * DAY, NOW + 2 * DAY)).toBe('24 hours');
    expect(formatTimeRemaining(NOW + 3 * DAY, NOW + 3 * DAY - 10)).toBe('less than a minute');
  });

  it.each([
    ['at the deadline', NOW],
    ['past it', NOW + 1],
  ])('is null %s, leaving the words to the surface', (_label, now) => {
    expect(formatTimeRemaining(NOW, now)).toBeNull();
  });

  it('is null for an unreadable deadline rather than a sentence about one', () => {
    expect(formatTimeRemaining(Number.NaN, NOW)).toBeNull();
  });

  it('takes unix seconds, and the clock by default', () => {
    const now = Date.now() / 1_000;
    expect(formatTimeRemaining(Math.round(now) + 5 * HOUR)).toBe('5 hours');
  });
});
