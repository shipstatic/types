import { describe, expect, it } from 'vitest';
import {
  type ActivityListResponse,
  API_KEY,
  AUTH_BASE_PATH,
  AuthMethod,
  BLOCKED_EXTENSIONS,
  CALLER,
  classifyToken,
  DEPLOY_TOKEN,
  type DeploymentListResponse,
  type DeploymentResource,
  DeploymentVia,
  type DeploymentViaType,
  type DomainListResponse,
  type DomainResource,
  FileValidationStatus,
  type FileValidationStatusType,
  hasUnbuiltMarker,
  hasUnsafeChars,
  IDEMPOTENCY_KEY_CONSTRAINTS,
  isBlockedExtension,
  LABEL_CONSTRAINTS,
  LABEL_PATTERN,
  normalizeVia,
  OAuthScope,
  type OAuthScopeType,
  PASSWORD_CONSTRAINTS,
  type PlatformLimits,
  TokenKind,
  type TokenListResponse,
  type TokenResource,
  UNBUILT_PROJECT_MARKERS,
  UNSAFE_FILENAME_CHARS,
  validateCaller,
  validatePassword,
  validateToken,
  WEB_FILE_ACCEPT,
} from '../src/index';

describe('Validation Constants - @shipstatic/types', () => {
  describe('BLOCKED_EXTENSIONS', () => {
    it('should block executable extensions', () => {
      const executables = [
        'exe',
        'msi',
        'dll',
        'scr',
        'bat',
        'cmd',
        'com',
        'pif',
        'app',
        'deb',
        'rpm',
      ];
      for (const ext of executables) {
        expect(BLOCKED_EXTENSIONS.has(ext)).toBe(true);
      }
    });

    it('should block disk image extensions', () => {
      const diskImages = ['dmg', 'iso', 'img'];
      for (const ext of diskImages) {
        expect(BLOCKED_EXTENSIONS.has(ext)).toBe(true);
      }
    });

    it('should block dangerous script extensions', () => {
      const scripts = ['ps1', 'vbs', 'vbe', 'ws', 'wsf', 'wsc', 'wsh', 'reg'];
      for (const ext of scripts) {
        expect(BLOCKED_EXTENSIONS.has(ext)).toBe(true);
      }
    });

    it('should block installer extensions', () => {
      const installers = ['pkg', 'mpkg'];
      for (const ext of installers) {
        expect(BLOCKED_EXTENSIONS.has(ext)).toBe(true);
      }
    });

    it('should block Java extensions', () => {
      expect(BLOCKED_EXTENSIONS.has('jar')).toBe(true);
      expect(BLOCKED_EXTENSIONS.has('jnlp')).toBe(true);
    });

    it('should block mobile and browser package extensions', () => {
      expect(BLOCKED_EXTENSIONS.has('apk')).toBe(true);
      expect(BLOCKED_EXTENSIONS.has('crx')).toBe(true);
    });

    it('should block shortcut/link extensions', () => {
      const shortcuts = ['lnk', 'inf', 'hta'];
      for (const ext of shortcuts) {
        expect(BLOCKED_EXTENSIONS.has(ext)).toBe(true);
      }
    });

    it('should NOT block web file extensions', () => {
      const webExtensions = [
        'html',
        'css',
        'js',
        'json',
        'png',
        'jpg',
        'svg',
        'woff2',
        'pdf',
        'wasm',
      ];
      for (const ext of webExtensions) {
        expect(BLOCKED_EXTENSIONS.has(ext)).toBe(false);
      }
    });

    it('should NOT block unknown extensions', () => {
      const unknownExtensions = ['xyz', 'custom', 'parquet', 'avro'];
      for (const ext of unknownExtensions) {
        expect(BLOCKED_EXTENSIONS.has(ext)).toBe(false);
      }
    });
  });

  describe('WEB_FILE_ACCEPT', () => {
    // Parsed from the PUBLISHED string rather than an exported array: the
    // attribute value is the whole contract, so the fence must hold against
    // exactly what a consumer receives.
    const tokens = WEB_FILE_ACCEPT.split(',');
    const extensions = tokens.map((token) => token.slice(1));

    it('offers nothing the platform will refuse', () => {
      // THE invariant. A picker that shows a file the deploy then rejects
      // turns a hint into a lie, and there is no second place to catch it.
      const offered = extensions.filter((ext) => BLOCKED_EXTENSIONS.has(ext));
      expect(offered).toEqual([]);
    });

    it('is a well-formed accept attribute', () => {
      for (const token of tokens) {
        expect(token).toMatch(/^\.[a-z0-9]+$/);
      }
      expect(new Set(extensions).size).toBe(extensions.length);
    });

    it('offers a ZIP — a whole site in one file is the headline case', () => {
      expect(extensions).toContain('zip');
    });

    it('offers the files a static site is actually made of', () => {
      const staples = ['html', 'css', 'js', 'json', 'svg', 'png', 'woff2', 'webmanifest'];
      for (const ext of staples) {
        expect(extensions).toContain(ext);
      }
    });
  });

  describe('isBlockedExtension()', () => {
    it('should detect blocked extensions from filenames', () => {
      expect(isBlockedExtension('virus.exe')).toBe(true);
      expect(isBlockedExtension('installer.msi')).toBe(true);
      expect(isBlockedExtension('script.bat')).toBe(true);
      expect(isBlockedExtension('disk.dmg')).toBe(true);
      expect(isBlockedExtension('archive.jar')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(isBlockedExtension('virus.EXE')).toBe(true);
      expect(isBlockedExtension('virus.Exe')).toBe(true);
      expect(isBlockedExtension('disk.DMG')).toBe(true);
    });

    it('should allow web files', () => {
      expect(isBlockedExtension('index.html')).toBe(false);
      expect(isBlockedExtension('style.css')).toBe(false);
      expect(isBlockedExtension('app.js')).toBe(false);
      expect(isBlockedExtension('data.json')).toBe(false);
      expect(isBlockedExtension('photo.png')).toBe(false);
    });

    it('should allow unknown extensions', () => {
      expect(isBlockedExtension('data.parquet')).toBe(false);
      expect(isBlockedExtension('file.custom')).toBe(false);
      expect(isBlockedExtension('model.onnx')).toBe(false);
    });

    it('should allow files without extensions', () => {
      expect(isBlockedExtension('README')).toBe(false);
      expect(isBlockedExtension('Makefile')).toBe(false);
      expect(isBlockedExtension('LICENSE')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isBlockedExtension('')).toBe(false);
      expect(isBlockedExtension('file.')).toBe(false);
      expect(isBlockedExtension('.gitignore')).toBe(false);
    });

    it('should check last extension only (double extensions)', () => {
      expect(isBlockedExtension('image.jpg.exe')).toBe(true);
      expect(isBlockedExtension('safe.exe.txt')).toBe(false);
    });
  });

  describe('UNBUILT_PROJECT_MARKERS', () => {
    it('should contain node_modules', () => {
      expect(UNBUILT_PROJECT_MARKERS.has('node_modules')).toBe(true);
    });

    it('should contain package.json', () => {
      expect(UNBUILT_PROJECT_MARKERS.has('package.json')).toBe(true);
    });

    it('should NOT match partial names', () => {
      expect(UNBUILT_PROJECT_MARKERS.has('node')).toBe(false);
      expect(UNBUILT_PROJECT_MARKERS.has('modules')).toBe(false);
      expect(UNBUILT_PROJECT_MARKERS.has('package')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(UNBUILT_PROJECT_MARKERS.has('Node_Modules')).toBe(false);
      expect(UNBUILT_PROJECT_MARKERS.has('NODE_MODULES')).toBe(false);
      expect(UNBUILT_PROJECT_MARKERS.has('Package.json')).toBe(false);
    });
  });

  describe('hasUnbuiltMarker()', () => {
    it('should detect node_modules in paths', () => {
      expect(hasUnbuiltMarker('node_modules/react/index.js')).toBe(true);
      expect(hasUnbuiltMarker('project/node_modules/lodash/lodash.js')).toBe(true);
    });

    it('should detect node_modules as a standalone segment', () => {
      expect(hasUnbuiltMarker('node_modules')).toBe(true);
    });

    it('should detect package.json in paths', () => {
      expect(hasUnbuiltMarker('package.json')).toBe(true);
      expect(hasUnbuiltMarker('myproject/package.json')).toBe(true);
    });

    it('should handle backslash paths', () => {
      expect(hasUnbuiltMarker('project\\node_modules\\react\\index.js')).toBe(true);
      expect(hasUnbuiltMarker('project\\package.json')).toBe(true);
    });

    it('should return false for clean build output paths', () => {
      expect(hasUnbuiltMarker('dist/index.html')).toBe(false);
      expect(hasUnbuiltMarker('build/static/app.js')).toBe(false);
      expect(hasUnbuiltMarker('out/index.html')).toBe(false);
      expect(hasUnbuiltMarker('index.html')).toBe(false);
    });

    it('should not match partial directory names', () => {
      expect(hasUnbuiltMarker('my_node_modules_backup/file.js')).toBe(false);
      expect(hasUnbuiltMarker('not_node_modules/file.js')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(hasUnbuiltMarker('Node_Modules/react/index.js')).toBe(false);
      expect(hasUnbuiltMarker('NODE_MODULES/react/index.js')).toBe(false);
      expect(hasUnbuiltMarker('Package.JSON')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(hasUnbuiltMarker('')).toBe(false);
      expect(hasUnbuiltMarker('/')).toBe(false);
      expect(hasUnbuiltMarker('//')).toBe(false);
    });
  });

  describe('UNSAFE_FILENAME_CHARS', () => {
    it('should block URL round-trip breakers', () => {
      expect(hasUnsafeChars('file#anchor.html')).toBe(true);
      expect(hasUnsafeChars('file?query.html')).toBe(true);
      expect(hasUnsafeChars('file%20name.html')).toBe(true);
    });

    it('should block backslash (path separator confusion)', () => {
      expect(hasUnsafeChars('file\\path.html')).toBe(true);
    });

    it('should block XSS vectors', () => {
      expect(hasUnsafeChars('file<tag>.html')).toBe(true);
      expect(hasUnsafeChars('file>end.html')).toBe(true);
      expect(hasUnsafeChars('file"quote.html')).toBe(true);
    });

    it('should block control characters', () => {
      expect(hasUnsafeChars('file\x00null.html')).toBe(true);
      expect(hasUnsafeChars('file\ttab.html')).toBe(true);
      expect(hasUnsafeChars('file\nnewline.html')).toBe(true);
      expect(hasUnsafeChars('file\rreturn.html')).toBe(true);
      expect(hasUnsafeChars('file\x1fcontrol.html')).toBe(true);
      expect(hasUnsafeChars('file\x7fdelete.html')).toBe(true);
    });

    it('should allow all characters that survive the URL round-trip', () => {
      const safeNames = [
        'saved_resource(1).html',
        'page[slug].js',
        'route{id}.html',
        "O'Brien.html",
        'file&param.html',
        'config;v2.json',
        'price$10.txt',
        'file~backup.html',
        'file|pipe.txt',
        'file^caret.txt',
        'file`tick`.js',
        'file*star.txt',
        'file!bang.txt',
        'file+plus.txt',
        'file,comma.txt',
        'file=equals.txt',
        'file@at.txt',
        'file:colon.txt',
        'my file.txt',
        'Dashboard Overview_files/js(1)',
      ];

      for (const name of safeNames) {
        expect(hasUnsafeChars(name)).toBe(false);
      }
    });

    it('should be the single source of truth (regex is exported)', () => {
      expect(UNSAFE_FILENAME_CHARS).toBeInstanceOf(RegExp);
    });
  });

  describe('PlatformLimits', () => {
    it('should have correct shape with 3 fields', () => {
      const config: PlatformLimits = {
        maxFileSize: 20 * 1024 * 1024,
        maxFilesCount: 500,
        maxTotalSize: 50 * 1024 * 1024,
      };

      expect(typeof config.maxFileSize).toBe('number');
      expect(typeof config.maxFilesCount).toBe('number');
      expect(typeof config.maxTotalSize).toBe('number');
    });

    it('should only contain numeric limit fields', () => {
      const config: PlatformLimits = {
        maxFileSize: 20 * 1024 * 1024,
        maxFilesCount: 500,
        maxTotalSize: 50 * 1024 * 1024,
      };

      expect(Object.keys(config)).toEqual(['maxFileSize', 'maxFilesCount', 'maxTotalSize']);
    });
  });

  describe('FileValidationStatus', () => {
    it('should have all required status values', () => {
      expect(FileValidationStatus.READY).toBe('ready');
      expect(FileValidationStatus.VALIDATION_FAILED).toBe('validation_failed');
      expect(FileValidationStatus.EXCLUDED).toBe('excluded');
      expect(FileValidationStatus.PROCESSING_ERROR).toBe('processing_error');
    });

    it('should be usable as a type guard', () => {
      const status: FileValidationStatusType = FileValidationStatus.READY;
      expect(status).toBe('ready');
    });

    it('should have no duplicate values', () => {
      const values = Object.values(FileValidationStatus);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe('AUTH_BASE_PATH', () => {
    // The identity mount is a wire contract — the API mounts Better Auth
    // here and the web console's auth client posts here. Changing it is a
    // coordinated breaking change across the auth pair.
    it('should be the /auth mount both halves agree on', () => {
      expect(AUTH_BASE_PATH).toBe('/auth');
    });
  });

  describe('AuthMethod', () => {
    it('should have all credential populations', () => {
      expect(AuthMethod.SESSION).toBe('session');
      expect(AuthMethod.API_KEY).toBe('apiKey');
      expect(AuthMethod.TOKEN).toBe('token');
      expect(AuthMethod.AGENT).toBe('agent');
      expect(AuthMethod.OAUTH).toBe('oauth');
      expect(AuthMethod.WEBHOOK).toBe('webhook');
      expect(AuthMethod.SYSTEM).toBe('system');
    });

    it('should have no duplicate values', () => {
      const values = Object.values(AuthMethod);
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe('OAuthScope', () => {
    // Scope strings are a wire contract — OAuth clients hold grants recorded
    // against these exact values. Changing one invalidates issued tokens.
    it('should have the exact platform scope vocabulary', () => {
      expect(OAuthScope.ACCOUNT_READ).toBe('account:read');
      expect(OAuthScope.DEPLOYMENTS_READ).toBe('deployments:read');
      expect(OAuthScope.DEPLOYMENTS_WRITE).toBe('deployments:write');
      expect(OAuthScope.DOMAINS_READ).toBe('domains:read');
      expect(OAuthScope.DOMAINS_WRITE).toBe('domains:write');
      expect(Object.keys(OAuthScope)).toHaveLength(5);
    });

    it('should never contain credential-minting or admin scopes', () => {
      const values = Object.values(OAuthScope) as string[];
      for (const scope of values) {
        expect(scope).not.toMatch(/token|key|admin|account:write/);
      }
    });

    it('should be usable as a type', () => {
      const scope: OAuthScopeType = OAuthScope.DEPLOYMENTS_WRITE;
      expect(scope).toBe('deployments:write');
    });
  });

  describe('TokenKind & classifyToken()', () => {
    it('classifies by prefix — the shared wire dispatch', () => {
      expect(classifyToken(`ship-${'a'.repeat(API_KEY.HEX_LENGTH)}`)).toBe(TokenKind.API_KEY);
      expect(classifyToken(`deploy-${'a'.repeat(DEPLOY_TOKEN.HEX_LENGTH)}`)).toBe(
        TokenKind.DEPLOY_TOKEN,
      );
      expect(classifyToken('some-oauth-access-token')).toBe(TokenKind.OPAQUE);
      expect(classifyToken('')).toBe(TokenKind.OPAQUE);
    });

    it('classifies by prefix alone — format validity is a separate concern', () => {
      expect(classifyToken('ship-tooshort')).toBe(TokenKind.API_KEY);
      expect(classifyToken('deploy-tooshort')).toBe(TokenKind.DEPLOY_TOKEN);
    });

    it('kinds are structurally the AuthMethod values — and both pin the wire literals', () => {
      // The identity is structural (TokenKind derives from AuthMethod); these
      // literals pin the WIRE values, which a rename of either would break.
      expect(TokenKind.API_KEY).toBe(AuthMethod.API_KEY);
      expect(TokenKind.DEPLOY_TOKEN).toBe(AuthMethod.TOKEN);
      expect(TokenKind.API_KEY).toBe('apiKey');
      expect(TokenKind.DEPLOY_TOKEN).toBe('token');
      expect(TokenKind.OPAQUE).toBe('opaque');
    });
  });

  describe('CALLER & validateCaller()', () => {
    it('accepts identifiers within the shape', () => {
      expect(validateCaller('my-orchestrator')).toBeUndefined();
      expect(validateCaller('user_42.session')).toBeUndefined();
      expect(validateCaller('a'.repeat(CALLER.MAX_LENGTH))).toBeUndefined();
    });

    it('rejects empty, oversized, and out-of-charset identifiers', () => {
      expect(() => validateCaller('')).toThrow(/Caller/);
      expect(() => validateCaller('a'.repeat(CALLER.MAX_LENGTH + 1))).toThrow(/Caller/);
      expect(() => validateCaller('has space')).toThrow(/Caller/);
      expect(() => validateCaller('new\nline')).toThrow(/Caller/);
    });
  });

  describe('validateToken()', () => {
    it('applies strict format rules to prefixed populations', () => {
      expect(() => validateToken('ship-tooshort')).toThrow(/characters total/);
      expect(() => validateToken('deploy-tooshort')).toThrow(/characters total/);
      // Widths come from the shape constants, never a literal: a hand-written
      // length here would pass while the population it describes had moved.
      expect(validateToken(`ship-${'a'.repeat(API_KEY.HEX_LENGTH)}`)).toBeUndefined();
      expect(validateToken(`deploy-${'b'.repeat(DEPLOY_TOKEN.HEX_LENGTH)}`)).toBeUndefined();
    });

    it('passes opaque tokens through when non-empty', () => {
      expect(validateToken('oauth-access-token-value')).toBeUndefined();
      expect(() => validateToken('')).toThrow(/non-empty/);
    });
  });

  describe('LABEL_PATTERN', () => {
    it('should match valid labels', () => {
      const valid = [
        'prod',
        'staging',
        'dev',
        'v1.0.0',
        'feature-x',
        'test_env',
        'release.candidate',
      ];

      valid.forEach((label) => {
        expect(LABEL_PATTERN.test(label)).toBe(true);
      });
    });

    it('should reject invalid label formats', () => {
      const invalidFormat = ['-prod', 'prod-', 'pr od', 'PROD'];

      invalidFormat.forEach((label) => {
        expect(LABEL_PATTERN.test(label)).toBe(false);
      });
    });

    it('should not enforce length constraints in pattern', () => {
      expect(LABEL_PATTERN.test('a')).toBe(true);
      expect(LABEL_PATTERN.test('ab')).toBe(true);
      expect(LABEL_PATTERN.test('abc')).toBe(true);
      expect(LABEL_PATTERN.test('a'.repeat(100))).toBe(true);
    });

    it('should handle separator variations', () => {
      expect(LABEL_PATTERN.test('my-label')).toBe(true);
      expect(LABEL_PATTERN.test('my_label')).toBe(true);
      expect(LABEL_PATTERN.test('my.label')).toBe(true);
    });
  });

  describe('LABEL_CONSTRAINTS', () => {
    it('should define min length', () => {
      expect(LABEL_CONSTRAINTS.MIN_LENGTH).toBeGreaterThan(0);
      expect(typeof LABEL_CONSTRAINTS.MIN_LENGTH).toBe('number');
    });

    it('should define max length', () => {
      expect(LABEL_CONSTRAINTS.MAX_LENGTH).toBeGreaterThan(LABEL_CONSTRAINTS.MIN_LENGTH);
      expect(typeof LABEL_CONSTRAINTS.MAX_LENGTH).toBe('number');
    });

    it('should define max count', () => {
      expect(LABEL_CONSTRAINTS.MAX_COUNT).toBeGreaterThan(0);
      expect(typeof LABEL_CONSTRAINTS.MAX_COUNT).toBe('number');
    });

    it('should define allowed separators', () => {
      expect(LABEL_CONSTRAINTS.SEPARATORS).toBeDefined();
      expect(LABEL_CONSTRAINTS.SEPARATORS.length).toBeGreaterThan(0);
    });

    it('should have reasonable limits', () => {
      expect(LABEL_CONSTRAINTS.MIN_LENGTH).toBeGreaterThanOrEqual(1);
      expect(LABEL_CONSTRAINTS.MIN_LENGTH).toBeLessThanOrEqual(10);

      expect(LABEL_CONSTRAINTS.MAX_LENGTH).toBeGreaterThanOrEqual(10);
      expect(LABEL_CONSTRAINTS.MAX_LENGTH).toBeLessThanOrEqual(100);

      expect(LABEL_CONSTRAINTS.MAX_COUNT).toBeGreaterThanOrEqual(1);
      expect(LABEL_CONSTRAINTS.MAX_COUNT).toBeLessThanOrEqual(100);
    });
  });

  describe('PASSWORD_CONSTRAINTS', () => {
    it('should define min length', () => {
      expect(PASSWORD_CONSTRAINTS.MIN_LENGTH).toBeGreaterThan(0);
      expect(typeof PASSWORD_CONSTRAINTS.MIN_LENGTH).toBe('number');
    });

    it('should define max length', () => {
      expect(PASSWORD_CONSTRAINTS.MAX_LENGTH).toBeGreaterThan(PASSWORD_CONSTRAINTS.MIN_LENGTH);
      expect(typeof PASSWORD_CONSTRAINTS.MAX_LENGTH).toBe('number');
    });

    it('should have reasonable limits', () => {
      expect(PASSWORD_CONSTRAINTS.MIN_LENGTH).toBeGreaterThanOrEqual(4);
      expect(PASSWORD_CONSTRAINTS.MIN_LENGTH).toBeLessThanOrEqual(16);

      expect(PASSWORD_CONSTRAINTS.MAX_LENGTH).toBeGreaterThanOrEqual(64);
      expect(PASSWORD_CONSTRAINTS.MAX_LENGTH).toBeLessThanOrEqual(512);
    });
  });

  describe('validatePassword()', () => {
    it('returns undefined for absent values (undefined / null)', () => {
      expect(validatePassword(undefined)).toBeUndefined();
      expect(validatePassword(null)).toBeUndefined();
    });

    it('rejects non-string types', () => {
      expect(() => validatePassword(123)).toThrow(/string/);
      expect(() => validatePassword(true)).toThrow(/string/);
      expect(() => validatePassword({})).toThrow(/string/);
      expect(() => validatePassword([])).toThrow(/string/);
    });

    it('rejects strings shorter than the minimum length', () => {
      const tooShort = 'a'.repeat(PASSWORD_CONSTRAINTS.MIN_LENGTH - 1);
      expect(() => validatePassword(tooShort)).toThrow(/between/);
      expect(() => validatePassword('')).toThrow(/between/);
    });

    it('rejects strings longer than the maximum length', () => {
      const tooLong = 'a'.repeat(PASSWORD_CONSTRAINTS.MAX_LENGTH + 1);
      expect(() => validatePassword(tooLong)).toThrow(/between/);
    });

    it('returns the value unchanged at the boundaries (no whitespace)', () => {
      const min = 'a'.repeat(PASSWORD_CONSTRAINTS.MIN_LENGTH);
      const max = 'a'.repeat(PASSWORD_CONSTRAINTS.MAX_LENGTH);
      expect(validatePassword(min)).toBe(min);
      expect(validatePassword(max)).toBe(max);
    });

    it('trims leading and trailing whitespace before validating', () => {
      // Tabs, spaces, and newlines all count as whitespace per String#trim.
      expect(validatePassword('  hunter22  ')).toBe('hunter22');
      expect(validatePassword('\thunter22\n')).toBe('hunter22');
      expect(validatePassword('\n\r\thunter22 \t\r\n')).toBe('hunter22');
    });

    it('preserves whitespace inside the password — significant', () => {
      // Internal whitespace is part of the password and counts toward length.
      expect(validatePassword('my passphrase')).toBe('my passphrase');
      expect(validatePassword('  my passphrase  ')).toBe('my passphrase');
    });

    it('rejects whitespace-only strings (trim → empty → too short)', () => {
      expect(() => validatePassword('      ')).toThrow(/between/);
      expect(() => validatePassword('\t\t\t\t\t\t')).toThrow(/between/);
    });

    it('runs length validation against the trimmed value', () => {
      // Padded so the wire length is in-range, but the trimmed form is too
      // short. Intent is what matters — protect against paste accidents that
      // would otherwise create a 2-char password masquerading as 12.
      expect(() => validatePassword('     pw     ')).toThrow(/between/);
      // Same shape on the other side — trimmed form one over the cap.
      const overByOne = ` ${'a'.repeat(PASSWORD_CONSTRAINTS.MAX_LENGTH + 1)} `;
      expect(() => validatePassword(overByOne)).toThrow(/between/);
      // And the inverse — padded value, trimmed form lands exactly at the cap.
      const paddedAtMax = `   ${'a'.repeat(PASSWORD_CONSTRAINTS.MAX_LENGTH)}   `;
      expect(validatePassword(paddedAtMax)).toBe('a'.repeat(PASSWORD_CONSTRAINTS.MAX_LENGTH));
    });
  });
});

/**
 * The list-contract fence.
 *
 * Every paginated collection must be reachable the same way from every
 * client: a `list` that accepts `ListOptions`, answering exactly
 * `{ <collection>, cursor }`. `TokenResource.list` shipped without the
 * parameter while its response already paginated — an asymmetry that
 * compiled fine and only surfaced at the call site.
 *
 * These are compile-time assertions: `pnpm typecheck` fails if a resource
 * contract or a list response drifts from the shape. `Parameters<T> extends
 * []` distinguishes a genuinely nullary signature from one taking an
 * optional argument, which plain assignability cannot (a 0-arg function is
 * assignable to a 1-optional-arg type).
 */
describe('list contract coherence', () => {
  type TakesListOptions<T extends (...args: never[]) => unknown> =
    Parameters<T> extends [] ? false : true;
  type Paginated<T> = T extends { cursor: string | null } ? true : false;
  /** A page carries no aggregate — counts belong to a summary resource. */
  type HasNoTotal<T> = T extends { total: unknown } ? false : true;

  // Each line fails to compile if that resource's `list` stops taking options.
  const _deployments: TakesListOptions<DeploymentResource['list']> = true;
  const _domains: TakesListOptions<DomainResource['list']> = true;
  const _tokens: TakesListOptions<TokenResource['list']> = true;

  // …and if a list response stops carrying its cursor, or grows a total.
  const _deploymentList: Paginated<DeploymentListResponse> = true;
  const _domainList: Paginated<DomainListResponse> = true;
  const _tokenList: Paginated<TokenListResponse> = true;
  const _activityList: Paginated<ActivityListResponse> = true;
  const _deploymentsPure: HasNoTotal<DeploymentListResponse> = true;
  const _domainsPure: HasNoTotal<DomainListResponse> = true;
  const _tokensPure: HasNoTotal<TokenListResponse> = true;
  const _activitiesPure: HasNoTotal<ActivityListResponse> = true;

  it('holds at compile time', () => {
    // The assertions above ARE the fence; they fail the typecheck, not this
    // test. This body only keeps the bindings live so nothing prunes them —
    // hence `every`, not a hand-counted length that a new collection breaks.
    const assertions = [
      _deployments,
      _domains,
      _tokens,
      _deploymentList,
      _domainList,
      _tokenList,
      _activityList,
      _deploymentsPure,
      _domainsPure,
      _tokensPure,
      _activitiesPure,
    ];

    expect(assertions.every((held) => held)).toBe(true);
  });
});

describe('DeploymentVia — the origin vocabulary', () => {
  it('normalizes case and surrounding whitespace, the way the API always has', () => {
    // The server trimmed and lowercased before comparing; moving the rule
    // client-side is only safe if it reaches the identical verdict, so these
    // are the server's own transformations, not new leniency.
    expect(normalizeVia('  CLI  ')).toBe(DeploymentVia.CLI);
    expect(normalizeVia('Web')).toBe(DeploymentVia.WEB);
  });

  it('accepts every member of the vocabulary', () => {
    // Derived, so a member added to the const is covered without editing this.
    for (const via of Object.values(DeploymentVia)) {
      expect(normalizeVia(via)).toBe(via);
    }
  });

  it('answers undefined for anything outside the set, and never throws', () => {
    // Origin tracking is telemetry: a deploy must not fail because a wrapper
    // labelled itself something we do not know. `undefined` lets the caller
    // choose an honest default instead.
    for (const bad of ['github', '', '   ', 'CLI ish', null, undefined, 7, {}, []]) {
      expect(normalizeVia(bad)).toBeUndefined();
    }
  });

  it('types the request option but NOT the stored entity', () => {
    // Deliberate asymmetry: rows predate the vocabulary being closed, so the
    // entity's `via` stays `string | null`. These bindings fail the typecheck
    // if either half moves.
    const option: DeploymentViaType = DeploymentVia.GPT;
    const stored: string | null = 'some-legacy-value';
    expect(option).toBe('gpt');
    expect(stored).toBe('some-legacy-value');
  });
});

describe('IDEMPOTENCY_KEY_CONSTRAINTS', () => {
  it('owns the header name beside the format, like CALLER does', () => {
    // Both ends of one wire header read the name from here; it was a literal
    // in the API middleware, the SDK, and two CORS allow-lists.
    expect(IDEMPOTENCY_KEY_CONSTRAINTS.HEADER).toBe('Idempotency-Key');
  });
});
