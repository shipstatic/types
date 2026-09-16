/**
 * How long a deployment has left, in the words a person reads.
 *
 * When this module was written (2026-09-17) one deadline was told four ways:
 * the deploy card counted from now, the CLI and the marketing site from the
 * deployment's creation, the VS Code palette quoted the anonymous tier's fixed
 * lifetime, and the dashboard truncated, so a deployment made a second ago
 * read "2d" there and "3 days" everywhere else. The rule since: a surface that
 * tells a person how long a deployment has left says it with
 * `formatTimeRemaining`, and a duration a person reads about deployments is
 * spelled by `formatDuration`.
 *
 * The WORDS are the surface's own. A card says "Expires in", the marketing
 * site says "It stays live for", and each says something different once the
 * deadline has passed, which is why that case is `null` rather than a
 * sentence. What is owned here is the part that drifted silently: the unit,
 * the rounding, and what the clock is measured from.
 *
 * A subpath export (`@shipstatic/types/time`), for the same reason as
 * `/schemas`: a browser bundle importing only this carries only this. From the
 * main entry it would carry about a kilobyte of unrelated constants that a
 * bundler cannot prove are unused (1 KB gzipped, measured with the deploy
 * card's esbuild on 2026-09-17).
 */

/**
 * A span of time in words: `"3 days"`, `"5 hours"`, `"45 minutes"`.
 *
 * Minutes under two hours, hours under two days, and days beyond, each rounded
 * to the nearest. The unit changes exactly where the larger one rounds to two,
 * so the number never jumps as time passes (119 minutes, then 2 hours), and
 * the two vaguest things a rounded clock can say, "1 hour" and "1 day", are
 * never said. Rounding rather than truncating is what lets a deployment made a
 * second ago read the lifetime it was given: "3 days", not "2 days". Days are
 * the largest unit because nobody counts a deadline in weeks, and a month has
 * no fixed length.
 *
 * A span that rounds to no minutes at all, zero and negative included, reads
 * "less than a minute".
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (!(minutes >= 1)) return 'less than a minute';
  if (minutes < 120) return countOf(minutes, 'minute');
  const hours = Math.round(seconds / 3_600);
  if (hours < 48) return countOf(hours, 'hour');
  return countOf(Math.round(seconds / 86_400), 'day');
}

/**
 * The time left before a deadline, in words (`"3 days"`), or `null` once it
 * has passed.
 *
 * `expires` is unix SECONDS, the wire's own field, taken as it arrives so that
 * no caller converts it: the deploy card once read it as a date string and
 * showed the same three days on every deployment for months. `now` is seconds
 * too, and defaults to the clock.
 */
export function formatTimeRemaining(
  expires: number,
  now: number = Date.now() / 1_000,
): string | null {
  const seconds = expires - now;
  return seconds > 0 ? formatDuration(seconds) : null;
}

function countOf(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}
