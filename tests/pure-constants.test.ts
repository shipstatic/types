/**
 * @file Suite-time fence: a top-level constant computed by a call is marked
 * pure.
 *
 * Every consumer bundles this package's one entry, and a bundler keeps a
 * top-level call it cannot prove free of side effects, whether or not its
 * result is read. So a constant computed by a call (`new Set(...)`,
 * `Object.assign(...)`, a `.map(...)`, a template that calls) rides into
 * every bundle unless it carries `/* @__PURE__ *\/`, the mark bundlers read
 * as "drop this if unused". A call whose arguments compute is wrapped in a
 * function marked pure, since a bundler keeps a marked call's arguments.
 *
 * The consumer this protects is the platform's frozen router, whose built
 * bundle is held to a recorded digest: without the marks it carried the
 * console's path grammar, the error vocabulary's derived sets and the doors,
 * and any change to them moved a digest the router never asked to move.
 * `CLAUDE.md`, "Platform constants", states the rule.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');

const MARK = '/* @__PURE__ */';

/**
 * A top-level `const` and the start of its initializer, one per line:
 * `export const X = …` and `const X: T = …`.
 */
const TOP_LEVEL = /^(?:export )?const (\w+)(?::[^=]+)? = (.*)$/gm;

/** Whether an initializer is computed by a call: `new`, a call, or a template that calls. */
const computed = (initializer: string): boolean => {
  const bare = initializer.startsWith(MARK)
    ? initializer.slice(MARK.length).trimStart()
    : initializer;
  return (
    /^new /.test(bare) ||
    /^[A-Za-z_$][\w$.]*\(/.test(bare) ||
    /^\(\s*\(\)\s*=>/.test(bare) ||
    /^`[^`]*\$\{[^}]*\(/.test(bare)
  );
};

/** The constants a source computes by a call, each with whether it carries the mark. */
function constantsOf(source: string): { name: string; marked: boolean }[] {
  return [...source.matchAll(TOP_LEVEL)]
    .filter(([, , initializer]) => computed(initializer))
    .map(([, name, initializer]) => ({ name, marked: initializer.startsWith(MARK) }));
}

describe('top-level constants computed by a call', () => {
  it('each carry the pure mark, so a bundle that never reads one drops it', () => {
    const unmarked = constantsOf(SOURCE)
      .filter(({ marked }) => !marked)
      .map(({ name }) => name);
    expect(unmarked).toEqual([]);
  });

  it('are found by this reader, every kind of them (the fence reads what it holds)', () => {
    const names = constantsOf(SOURCE).map(({ name }) => name);
    for (const name of [
      'CLIENT_ONLY_ERROR_TYPES',
      'SERVER_PRODUCIBLE_ERROR_TYPES',
      'WEB_FILE_ACCEPT',
      'UNBUILT_PROJECT_MARKERS',
      'login',
      'MY_API_KEY_URL',
    ]) {
      expect(names, name).toContain(name);
    }
  });

  it('would catch an unmarked one of each kind (the fence against the state it holds)', () => {
    const planted = [
      'const A = new Set([1]);',
      'export const B: string = LIST.map((x) => x).join(",");',
      'const C = Object.assign(() => 1, {});',
      'export const D = `https://x${paths().key()}`;',
      `export const E = ${MARK} (() => 1)();`,
      "export const F = 'literal';",
    ].join('\n');
    expect(constantsOf(planted)).toEqual([
      { name: 'A', marked: false },
      { name: 'B', marked: false },
      { name: 'C', marked: false },
      { name: 'D', marked: false },
      { name: 'E', marked: true },
    ]);
  });
});
