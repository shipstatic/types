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
  canonicalDeployPath,
  DEPLOYMENT_INDEX_FILENAME,
  type DeployEntry,
  type DeployRuleFile,
  deployRefusal,
  FILE_RULES,
  firstBrokenRule,
  isDeployablePath,
  isPublishedFile,
  MAX_PATH_BYTES,
  namedTwice,
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

/** Files as sent, each one byte unless it is named with a size. */
const sent = (...paths: (string | DeployEntry)[]): DeployEntry[] =>
  paths.map((entry) => (typeof entry === 'string' ? { path: entry, size: 1 } : entry));

describe('the rules for the deployment as a whole', () => {
  const CASES: [string, DeployEntry[], string][] = [
    ['files', [], 'There are no files to publish.'],
    ['unique', sent('index.html', 'a.js', 'a.js'), 'The file a.js appears twice.'],
    [
      'filesCount',
      sent('index.html', 'a.js', 'b.js', 'c.js'),
      'Too many files (4). Maximum 3 files allowed.',
    ],
    [
      'index',
      sent('about.html'),
      "There's no index.html at the top of your site. It's the page visitors see first, so your site needs one. If one of your pages is the main one, put it at the top and name it index.html.",
    ],
  ];

  it.each(CASES)('%s produces its one sentence', (name, files, sentence) => {
    const broken = SET_RULES.find((rule) => rule.broken(files, LIMITS));
    expect(broken?.name).toBe(name);
    expect(broken?.sentence(files, LIMITS)).toBe(sentence);
  });

  it('counts only what is published: empty files are no files', () => {
    const broken = SET_RULES.find((rule) => rule.broken(sent({ path: 'a.js', size: 0 }), LIMITS));
    expect(broken?.name).toBe('files');
    const fits = sent('index.html', 'a.js', 'b.js', { path: 'c.js', size: 0 });
    expect(SET_RULES.find((rule) => rule.broken(fits, LIMITS))).toBeUndefined();
  });

  it('covers every rule, in the order they apply', () => {
    expect(CASES.map(([name]) => name)).toEqual(SET_RULES.map((rule) => rule.name));
  });

  it('reads a path and its leading-slash spelling as one file', () => {
    const broken = SET_RULES.find((rule) => rule.broken(sent('index.html', '/index.html'), LIMITS));
    expect(broken?.sentence(sent('index.html', '/index.html'), LIMITS)).toBe(
      'The file index.html appears twice.',
    );
  });

  it('refuses a path named twice even when one copy is empty', () => {
    const files = sent('index.html', 'a.js', { path: 'a.js', size: 0 });
    expect(SET_RULES.find((rule) => rule.broken(files, LIMITS))?.name).toBe('unique');
  });

  it('says a repeat in the words the API intake uses', () => {
    expect(namedTwice('a.js')).toBe('The file a.js appears twice.');
  });

  it('names the home page by its one owner', () => {
    expect(DEPLOYMENT_INDEX_FILENAME).toBe('index.html');
  });
});

describe('the home page', () => {
  const refusal = (...paths: (string | DeployEntry)[]) =>
    deployRefusal(sent(...paths), { ...LIMITS, maxFilesCount: 100 });

  it('is index.html at the root, exactly', () => {
    expect(refusal('index.html', 'a.css')).toBeUndefined();
    expect(refusal('/index.html', 'a.css')).toBeUndefined();
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

  it('says an empty one is empty, not missing', () => {
    expect(refusal({ path: 'index.html', size: 0 }, 'a.css')).toBe(
      "The index.html at the top of your site is empty. It's the page visitors see first, so it needs content.",
    );
  });

  it('names no folder when two hold it at the same depth: either could be the site', () => {
    expect(refusal('blog/index.html', 'docs/index.html')).toBe(
      "There's no index.html at the top of your site. It's the page visitors see first, so your site needs one. If one of your pages is the main one, put it at the top and name it index.html.",
    );
  });

  it('asks for the main page to be named index.html when there are pages but no home page', () => {
    expect(refusal('report.html')).toBe(
      "There's no index.html at the top of your site. It's the page visitors see first, so your site needs one. If one of your pages is the main one, put it at the top and name it index.html.",
    );
    expect(refusal('guide/start.HTM', 'logo.png')).toMatch(/name it index\.html\.$/);
  });

  it('asks for a small page that links to the file when there is no page at all', () => {
    expect(refusal('photo.png')).toBe(
      "There's no index.html at the top of your site. It's the page visitors see first, so your site needs one. To publish a file on its own, like an image or a PDF, add a small index.html that links to it.",
    );
    expect(refusal('report.pdf', 'data.csv')).toMatch(
      /add a small index\.html that links to it\.$/,
    );
  });

  it('reads the advice from published files: an empty page is no page', () => {
    expect(refusal({ path: 'about.html', size: 0 }, 'photo.png')).toMatch(/links to it\.$/);
  });
});

describe('isPublishedFile', () => {
  it('publishes every file with bytes in it, and no empty one', () => {
    expect(isPublishedFile({ size: 1 })).toBe(true);
    expect(isPublishedFile({ size: 0 })).toBe(false);
  });
});

describe('deployRefusal', () => {
  it('leaves an empty file out of the per-file rules, never refusing it', () => {
    expect(
      deployRefusal(
        [
          { path: 'index.html', size: 10 },
          { path: 'installer.exe', size: 0 },
        ],
        LIMITS,
      ),
    ).toBeUndefined();
  });

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
  ])('refuses %j', (name, reason) => {
    expect(validateFileName(name)).toEqual({ valid: false, reason });
  });

  it.each(['index.html', 'café/menu.html', 'a b.html', 'v1.2/app.js', 'report..final.pdf'])(
    'accepts %j',
    (name) => {
      expect(validateFileName(name)).toEqual({ valid: true });
    },
  );
});

describe('isDeployablePath', () => {
  it.each([
    ['index.html', true],
    ['/index.html', true],
    ['.well-known/security.txt', true],
    ['blog/.well-known/x', false],
    ['.env', false],
    ['a/../b.html', false],
    ['../b.html', false],
    ['a//b.html', false],
    [`${'a'.repeat(256)}.html`, false],
    [`${'a/'.repeat(MAX_PATH_BYTES / 2)}x`, false],
  ])('%j → %s', (path, expected) => {
    expect(isDeployablePath(path)).toBe(expected);
  });
});

describe('canonicalDeployPath', () => {
  it.each([
    ['index.html', 'index.html'],
    ['/index.html', 'index.html'],
    ['/blog/a.html', 'blog/a.html'],
    ['//index.html', '//index.html'],
    ['///index.html', '///index.html'],
  ])('%j → %j', (path, canonical) => {
    expect(canonicalDeployPath(path)).toBe(canonical);
  });

  it.each(['index.html', '/index.html', '//index.html', '///index.html'])(
    'changes nothing when asked again: %j',
    (path) => {
      const once = canonicalDeployPath(path);
      expect(canonicalDeployPath(once)).toBe(once);
    },
  );
});

describe('leading slashes', () => {
  it.each([
    ['index.html', true],
    ['/index.html', true],
    ['//index.html', false],
    ['///index.html', false],
  ])('%j is deployable: %s', (path, deployable) => {
    expect(isDeployablePath(path)).toBe(deployable);
  });

  it('refuses //index.html by the path rule, never reading it as the home page', () => {
    expect(deployRefusal(sent('//index.html'), LIMITS)).toBe(
      'File "//index.html" can\'t be published: a folder or file name in its path starts with a dot, is empty, or is too long.',
    );
  });

  it('refuses it however many times the path was made canonical before the rules', () => {
    const once = canonicalDeployPath('//index.html');
    expect(deployRefusal(sent(once), LIMITS)).toMatch(/^File "\/\/index\.html" can't be published/);
  });
});

describe('a traversal', () => {
  it('is refused by the path rule, which names what is wrong with it', () => {
    expect(deployRefusal(sent('index.html', 'a/../b.html'), LIMITS)).toBe(
      'File "a/../b.html" can\'t be published: a folder or file name in its path starts with a dot, is empty, or is too long.',
    );
  });
});
