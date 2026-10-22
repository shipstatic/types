/**
 * The deploy rules: every rule a deployment's files are held to, by the API
 * at its declaration and by every client before it sends a byte. Every
 * sentence is pinned by hand, because these are what a person reads when a
 * deploy is refused, and an expectation computed from the table would agree
 * with it by construction. Each table is tied to production by its names, in
 * order, so a rule cannot half-exist.
 */

import { describe, expect, it } from 'vitest';
import {
  DEPLOYMENT_INDEX_FILENAME,
  type DeployRuleFile,
  deployRefusal,
  FILE_RULES,
  firstBrokenRule,
  isDeployablePath,
  MAX_PATH_BYTES,
  type PlatformLimits,
  SET_RULES,
  validateFileName,
} from '../src/index';

const MB = 1024 * 1024;

const LIMITS: PlatformLimits = {
  maxFileSize: 5 * MB,
  maxFilesCount: 3,
  maxTotalSize: 8 * MB,
  blockedExtensions: ['exe', 'dmg'],
};

/** A file that breaks nothing, so each case below breaks exactly one rule. */
const clean: DeployRuleFile = { path: 'about.html', size: 1024, totalSize: 1024 };

describe('the file rules', () => {
  const CASES: [string, DeployRuleFile, string][] = [
    [
      'name',
      { ...clean, path: 'bad<name>.html' },
      'File name "bad<name>.html" contains unsafe characters.',
    ],
    [
      'extension',
      { ...clean, path: 'installer.exe' },
      'File "installer.exe" has an extension that is not allowed.',
    ],
    [
      'project',
      { ...clean, path: 'node_modules/react/index.js' },
      'File "node_modules/react/index.js" belongs to a project that isn\'t built yet. Build it, then publish the folder the build makes, like dist.',
    ],
    [
      'path',
      { ...clean, path: 'assets/.cache/a.js' },
      'File "assets/.cache/a.js" can\'t be published: a folder or file name in its path starts with a dot, is empty, or is too long.',
    ],
    [
      'fileSize',
      { ...clean, path: 'huge.bin', size: 6 * MB, totalSize: 6 * MB },
      'File "huge.bin" is too large. Maximum 5 MB allowed.',
    ],
    [
      'totalSize',
      { ...clean, path: 'last.bin', totalSize: 9 * MB },
      'Files add up to 9 MB. Maximum 8 MB allowed.',
    ],
  ];

  it.each(CASES)('%s produces its one sentence', (name, file, sentence) => {
    const broken = firstBrokenRule(file, LIMITS);
    expect(broken?.name).toBe(name);
    expect(broken?.sentence(file, LIMITS)).toBe(sentence);
  });

  it.each(CASES)('%s names its file once, or none when its subject is the set', (name, file) => {
    const sentence = firstBrokenRule(file, LIMITS)?.sentence(file, LIMITS) ?? '';
    expect(sentence.split(`"${file.path}"`).length - 1).toBe(name === 'totalSize' ? 0 : 1);
  });

  it('covers every rule, in the order they apply', () => {
    expect(CASES.map(([name]) => name)).toEqual(FILE_RULES.map((rule) => rule.name));
  });

  it('says nothing about a file that breaks nothing', () => {
    expect(firstBrokenRule(clean, LIMITS)).toBeUndefined();
  });

  it('reports the first broken rule: a file both misnamed and oversized reports the name', () => {
    const both = { path: 'bad<name>.exe', size: 9 * MB, totalSize: 9 * MB };
    expect(firstBrokenRule(both, LIMITS)?.name).toBe('name');
  });

  it('reads an absent blocklist as no check here, never as an empty policy', () => {
    const { blockedExtensions: _absent, ...withoutList } = LIMITS;
    expect(firstBrokenRule({ ...clean, path: 'installer.exe' }, withoutList)).toBeUndefined();
  });
});

describe('the rules for the deployment as a whole', () => {
  const CASES: [string, string[], string][] = [
    ['files', [], 'There are no files to publish.'],
    [
      'filesCount',
      ['index.html', 'a.js', 'b.js', 'c.js'],
      'Too many files (4). Maximum 3 files allowed.',
    ],
    [
      'index',
      ['about.html'],
      "There's no index.html at the top of your site. It's the page visitors see first, so your site needs one.",
    ],
  ];

  it.each(CASES)('%s produces its one sentence', (name, paths, sentence) => {
    const broken = SET_RULES.find((rule) => rule.broken(paths, LIMITS));
    expect(broken?.name).toBe(name);
    expect(broken?.sentence(paths, LIMITS)).toBe(sentence);
  });

  it('covers every rule, in the order they apply', () => {
    expect(CASES.map(([name]) => name)).toEqual(SET_RULES.map((rule) => rule.name));
  });

  it('names the home page by its one owner', () => {
    expect(DEPLOYMENT_INDEX_FILENAME).toBe('index.html');
  });
});

describe('the home page', () => {
  const refusal = (...paths: string[]) =>
    deployRefusal(
      paths.map((path) => ({ path, size: 1 })),
      { ...LIMITS, maxFilesCount: 100 },
    );

  it('is index.html at the root, exactly', () => {
    expect(refusal('index.html', 'a.css')).toBeUndefined();
    expect(refusal('Index.html')).toMatch(/^There's no index.html at the top of your site\./);
    expect(refusal('index.htm')).toMatch(/^There's no index.html/);
  });

  it('names the one folder that holds it, when the site sits a folder down', () => {
    expect(refusal('dist/index.html', 'dist/app.js', 'package-lock.txt')).toBe(
      "There's no index.html at the top of your site. It's the page visitors see first, so your site needs one. There's one in dist/. If that's your site, publish that folder instead.",
    );
  });

  it('names the shallowest folder, deeper pages being the site’s own', () => {
    expect(refusal('site/index.html', 'site/blog/index.html')).toMatch(
      /There's one in site\/\. If that's your site/,
    );
  });

  it('names no folder when two hold it at the same depth: either could be the site', () => {
    expect(refusal('blog/index.html', 'docs/index.html')).toBe(
      "There's no index.html at the top of your site. It's the page visitors see first, so your site needs one.",
    );
  });
});

describe('deployRefusal', () => {
  it('judges every file before the deployment as a whole', () => {
    expect(deployRefusal([{ path: 'installer.exe', size: 1 }], LIMITS)).toBe(
      'File "installer.exe" has an extension that is not allowed.',
    );
  });

  it('counts the total as it goes, so the file that tips it is the one refused', () => {
    const files = [
      { path: 'index.html', size: 4 * MB },
      { path: 'a.bin', size: 4 * MB },
      { path: 'b.bin', size: 1 * MB },
    ];
    expect(deployRefusal(files, LIMITS)).toBe('Files add up to 9 MB. Maximum 8 MB allowed.');
  });

  it('answers nothing for a deployment every rule holds for', () => {
    expect(deployRefusal([{ path: 'index.html', size: 10 }], LIMITS)).toBeUndefined();
  });

  it('ends a limit’s sentence with the way forward the API delivered, verbatim', () => {
    const limits: PlatformLimits = {
      ...LIMITS,
      suggestions: {
        maxFileSize: 'Upgrade to Pro for more.',
        maxFilesCount: 'Upgrade to Pro for more.',
        maxTotalSize: 'Please contact support if you need more.',
      },
    };
    expect(deployRefusal([{ path: 'huge.bin', size: 6 * MB }], limits)).toBe(
      'File "huge.bin" is too large. Maximum 5 MB allowed. Upgrade to Pro for more.',
    );
  });
});

describe('validateFileName', () => {
  it.each([
    ['', 'A file has no name.'],
    ['a#b.html', 'File name "a#b.html" contains unsafe characters.'],
    ['nul\u0000.html', 'File name "nul\u0000.html" contains unsafe characters.'],
    [' a.html', 'File name " a.html" cannot start or end with spaces.'],
    ['a.', 'File name "a." cannot end with dots.'],
    ['docs/CON.txt', 'File name "docs/CON.txt" uses a reserved system name.'],
    ['a/../b.html', 'File name "a/../b.html" contains a path traversal pattern.'],
  ])('refuses %j', (name, reason) => {
    expect(validateFileName(name)).toEqual({ valid: false, reason });
  });

  it.each(['index.html', 'café/menu.html', 'a b.html', 'v1.2/app.js'])('accepts %j', (name) => {
    expect(validateFileName(name)).toEqual({ valid: true });
  });
});

describe('isDeployablePath', () => {
  it.each([
    ['index.html', true],
    ['/index.html', true],
    ['.well-known/security.txt', true],
    ['blog/.well-known/x', false],
    ['.env', false],
    ['a//b.html', false],
    [`${'a'.repeat(256)}.html`, false],
    [`${'a/'.repeat(MAX_PATH_BYTES / 2)}x`, false],
  ])('%j → %s', (path, expected) => {
    expect(isDeployablePath(path)).toBe(expected);
  });
});
