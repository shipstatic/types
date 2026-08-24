import { describe, expect, it } from 'vitest';
import {
  type ActivityListResponse,
  API_KEY,
  AUTH_BASE_PATH,
  AuthMethod,
  CALLER,
  classifyToken,
  DEPLOY_FIELDS,
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
  OAUTH_TOKEN,
  OAuthScope,
  type OAuthScopeType,
  PASSWORD_CONSTRAINTS,
  type PlatformLimits,
  readBearerValue,
  TokenKind,
  type TokenListResponse,
  type TokenResource,
  TTL_CONSTRAINTS,
  UNBUILT_PROJECT_MARKERS,
  UNSAFE_FILENAME_CHARS,
  validateCaller,
  validatePassword,
  validateToken,
  validateTtl,
  WEB_FILE_ACCEPT,
} from '../src/index';

describe('Validation Constants - @shipstatic/types', () => {
  describe('WEB_FILE_ACCEPT', () => {
    // Parsed from the PUBLISHED string rather than an exported array: the
    // attribute value is the whole contract, so the fence must hold against
    // exactly what a consumer receives.
    const tokens = WEB_FILE_ACCEPT.split(',');
    const extensions = tokens.map((token) => token.slice(1));

    // THE invariant — "offers nothing the platform will refuse" — is fenced in
    // `cloudflare/api/tests/lib/blocklist.test.ts`, which owns the list to
    // compare against. What stays here is what this constant is true of on its
    // own terms.

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
    // Deliberately not the platform's real list — this package does not know
    // it. The API owns it and delivers it as `PlatformLimits.blockedExtensions`.
    const BLOCKED = ['exe', 'dmg', 'jar'];

    it('blocks a file whose extension is in the given list', () => {
      expect(isBlockedExtension('virus.exe', BLOCKED)).toBe(true);
      expect(isBlockedExtension('disk.dmg', BLOCKED)).toBe(true);
      expect(isBlockedExtension('archive.jar', BLOCKED)).toBe(true);
    });

    it('is case-insensitive on the filename', () => {
      expect(isBlockedExtension('virus.EXE', BLOCKED)).toBe(true);
      expect(isBlockedExtension('virus.Exe', BLOCKED)).toBe(true);
    });

    it('allows anything the list does not name', () => {
      expect(isBlockedExtension('index.html', BLOCKED)).toBe(false);
      expect(isBlockedExtension('app.js', BLOCKED)).toBe(false);
      expect(isBlockedExtension('data.custom', BLOCKED)).toBe(false);
      expect(isBlockedExtension('README', BLOCKED)).toBe(false);
    });

    it('accepts a Set as readily as an array — the API holds one of each', () => {
      expect(isBlockedExtension('virus.exe', new Set(BLOCKED))).toBe(true);
      expect(isBlockedExtension('index.html', new Set(BLOCKED))).toBe(false);
    });

    it('blocks nothing when the list is empty — the fail-open a client spells', () => {
      // A client talking to an API that predates `blockedExtensions` passes
      // `[]`. It must not guess: the boundary still refuses the file.
      expect(isBlockedExtension('virus.exe', [])).toBe(false);
    });

    // The matching RULE is what this package owns, and it is fenced HERE
    // rather than against the private `fileExtension` — this is the only
    // surface anyone can observe it through, so it is the only surface where
    // drift can be caught. Each case is a realistic (path, blocklist) pair.

    it('reads the LAST extension, which is the one that names the type', () => {
      expect(isBlockedExtension('image.jpg.exe', BLOCKED)).toBe(true);
      expect(isBlockedExtension('safe.exe.txt', BLOCKED)).toBe(false);
    });

    it('judges a path by its filename, not by a dotted directory above it', () => {
      // Realistic paths: a bundle's contents must deploy, each judged by its
      // own name. These hold under a naive `lastIndexOf('.')` too — see below.
      expect(isBlockedExtension('bundle.dmg/Contents/binary', BLOCKED)).toBe(false);
      expect(isBlockedExtension('assets/app.exe', BLOCKED)).toBe(true);
      expect(isBlockedExtension('a.exe/index.html', BLOCKED)).toBe(false);
      expect(isBlockedExtension('bundle.dmg\\binary', BLOCKED)).toBe(false);
    });

    it('cannot be tricked by a directory name — the white-box half', () => {
      // **The blocklist entry below is deliberately impossible in production,
      // and that impossibility is the whole point.** A naive
      // `lastIndexOf('.')` reader answers `dmg/Contents/binary` for this path
      // instead of `null` — but that garbage contains a slash, and a real
      // blocklist holds only bare extensions (`/^[a-z0-9]+$/`, fenced in
      // `cloudflare/api/tests/lib/blocklist.test.ts`), so the two readers
      // reach the SAME verdict on every realistic input. The property is
      // therefore unfalsifiable from outside unless the test supplies the
      // garbage itself.
      //
      // A property unfalsifiable from outside gets a white-box fence that
      // plants the impossible input itself, or it gets no fence at all. It
      // exists because the extractor's contract is "return the extension",
      // and one returning garbage is a latent bug the moment it acquires a
      // second caller.
      //
      // The entries are LOWERCASE because the reader lowercases what it
      // extracts — spelled `dmg/README`, this fence passes against the broken
      // reader too and holds nothing (drill story: `CLAUDE.md`, "The worked
      // split").
      expect(isBlockedExtension('dir.dmg/README', ['dmg/readme'])).toBe(false);
      expect(isBlockedExtension('dir.dmg\\README', ['dmg\\readme'])).toBe(false);
    });

    it('treats a leading dot as the name, not an extension', () => {
      // `.gitignore` is a dotfile called "gitignore", not a "gitignore" file.
      expect(isBlockedExtension('.exe', BLOCKED)).toBe(false);
      expect(isBlockedExtension('dir/.exe', BLOCKED)).toBe(false);
      // …but a dotfile CAN carry one.
      expect(isBlockedExtension('.env.exe', BLOCKED)).toBe(true);
    });

    it('reads no extension off a trailing dot or an empty name', () => {
      expect(isBlockedExtension('virus.exe.', BLOCKED)).toBe(false);
      expect(isBlockedExtension('', BLOCKED)).toBe(false);
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
    it('carries the three caps as numbers', () => {
      const config: PlatformLimits = {
        maxFileSize: 20 * 1024 * 1024,
        maxFilesCount: 500,
        maxTotalSize: 50 * 1024 * 1024,
      };

      expect(typeof config.maxFileSize).toBe('number');
      expect(typeof config.maxFilesCount).toBe('number');
      expect(typeof config.maxTotalSize).toBe('number');
    });

    it('carries the blocklist the API owns', () => {
      const config: PlatformLimits = {
        maxFileSize: 20 * 1024 * 1024,
        maxFilesCount: 500,
        maxTotalSize: 50 * 1024 * 1024,
        blockedExtensions: ['exe', 'dmg'],
      };

      expect(isBlockedExtension('virus.exe', config.blockedExtensions ?? [])).toBe(true);
    });

    it('is valid without the blocklist — an older API sends none', () => {
      // Compile-time half of the fail-open contract: the field is optional, so
      // a client cannot be written to assume it is there.
      const config: PlatformLimits = {
        maxFileSize: 20 * 1024 * 1024,
        maxFilesCount: 500,
        maxTotalSize: 50 * 1024 * 1024,
      };

      expect(config.blockedExtensions).toBeUndefined();
      expect(isBlockedExtension('virus.exe', config.blockedExtensions ?? [])).toBe(false);
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

  // The three clauses of the shape law, stated once at CREDENTIAL SHAPES in
  // src/index.ts. Each was true by construction and checked by nothing, which
  // is the state a law is in right before it quietly stops holding.
  describe('the credential shape law', () => {
    // Every Bearer population, with the kind its own prefix must classify to.
    // The kind rides the table rather than being reconstructed from the name,
    // so adding a population is one row and cannot half-land.
    const POPULATIONS = [
      ['API_KEY', API_KEY, TokenKind.API_KEY],
      ['DEPLOY_TOKEN', DEPLOY_TOKEN, TokenKind.DEPLOY_TOKEN],
      ['OAUTH_TOKEN', OAUTH_TOKEN, TokenKind.OAUTH],
    ] as const;

    it('one entropy standard — every minted population is the same width', () => {
      const widths = new Set(POPULATIONS.map(([, shape]) => shape.HEX_LENGTH));
      expect(widths.size).toBe(1);
    });

    it('total length is derived, never typed twice', () => {
      for (const [name, shape] of POPULATIONS) {
        expect(`${name}: ${shape.TOTAL_LENGTH}`).toBe(
          `${name}: ${shape.PREFIX.length + shape.HEX_LENGTH}`,
        );
      }
    });

    // THE one that makes classifyToken's two `if`s order-independent. A
    // `ship-` / `ship-deploy-` pair would read tidier and silently classify
    // every deploy token as an API key the day someone swapped the lines.
    it('no prefix is a prefix of another — so dispatch cannot depend on order', () => {
      for (const [aName, a] of POPULATIONS) {
        for (const [bName, b] of POPULATIONS) {
          if (aName === bName) continue;
          expect(`${aName} startsWith ${bName}: ${a.PREFIX.startsWith(b.PREFIX)}`).toBe(
            `${aName} startsWith ${bName}: false`,
          );
        }
      }
    });

    // The property the clause above buys, asserted through the real dispatch:
    // a well-formed member of each population classifies as itself, whichever
    // order the branches happen to sit in.
    it('every population classifies as itself', () => {
      for (const [name, shape, kind] of POPULATIONS) {
        const token = `${shape.PREFIX}${'a'.repeat(shape.HEX_LENGTH)}`;
        expect(`${name}: ${classifyToken(token)}`).toBe(`${name}: ${kind}`);
      }
    });

    // Clause 2 read as a completeness check rather than a per-member one: a
    // population added to the constitution without a classifier branch would
    // pass every test above (they all iterate this same table) and land in
    // OPAQUE at runtime, where the server refuses it. The dispatch's codomain
    // must therefore cover every population the table names.
    it('no population falls through to OPAQUE — the dispatch is total over them', () => {
      const unclassified = POPULATIONS.filter(
        ([, shape]) =>
          classifyToken(`${shape.PREFIX}${'a'.repeat(shape.HEX_LENGTH)}`) === TokenKind.OPAQUE,
      ).map(([name]) => name);

      expect(unclassified).toEqual([]);
    });

    // And the same for the format rules: a population classifying correctly
    // while `validateToken` has no arm for it would validate as "non-empty",
    // which is the OPAQUE rule wearing a prefixed population's clothes.
    it('every population is validated strictly, never as an opaque string', () => {
      for (const [name, shape] of POPULATIONS) {
        // Right prefix, wrong width — only a strict arm can tell.
        expect(() => validateToken(`${shape.PREFIX}tooshort`), name).toThrow(/characters total/);
        expect(validateToken(`${shape.PREFIX}${'a'.repeat(shape.HEX_LENGTH)}`)).toBeUndefined();
      }
    });
  });

  /**
   * The other half of the Bearer slot. Two workers hand-rolled this rule
   * (the api middleware's `readCredential`, the mcp worker's `readBearer`)
   * until 2026-08-14; the platform had already paid for getting it wrong
   * once, and the OAuth provider carries the same defect in four places.
   */
  describe('readBearerValue()', () => {
    const token = `${API_KEY.PREFIX}${'a'.repeat(API_KEY.HEX_LENGTH)}`;

    it('folds the scheme in any casing — RFC 7235 §2.1', () => {
      for (const scheme of ['Bearer', 'bearer', 'BEARER', 'BeArEr']) {
        expect(readBearerValue(`${scheme} ${token}`), scheme).toBe(token);
      }
    });

    it('NEVER folds the credential’s own bytes', () => {
      // The value is opaque and compared literally everywhere it is used.
      // Folding it would make a credential match values it is not — and the
      // populations are lowercase hex, so an upper-case one is simply wrong.
      const mixed = `${API_KEY.PREFIX}AbCdEf0123456789AbCdEf0123456789`;
      expect(readBearerValue(`Bearer ${mixed}`)).toBe(mixed);
    });

    it('refuses a foreign scheme', () => {
      for (const header of ['Basic abc123', 'Token abc123', 'bearerish abc']) {
        expect(readBearerValue(header), header).toBeNull();
      }
    });

    it('refuses a scheme with nothing after it', () => {
      // `Bearer ` with an empty value is a presented-but-broken credential,
      // not a missing one — the caller's own layer decides what to do about
      // that, but there is no value to hand it.
      expect(readBearerValue('Bearer ')).toBeNull();
      expect(readBearerValue('Bearer')).toBeNull();
      expect(readBearerValue('')).toBeNull();
    });

    it('keeps ABSENCE out of its answer — a caller passes a value, never a Request', () => {
      // Stated as a row because it is a design decision the api worker
      // depends on: `absent` (the only anonymous path) and `unreadable` (a
      // refusal) must stay distinguishable, and they cannot be if this
      // function collapses them. It never sees a missing header at all.
      expect(readBearerValue.length).toBe(1);
    });
  });

  describe('TokenKind & classifyToken()', () => {
    it('classifies by prefix — the shared wire dispatch', () => {
      expect(classifyToken(`ship-${'a'.repeat(API_KEY.HEX_LENGTH)}`)).toBe(TokenKind.API_KEY);
      expect(classifyToken(`deploy-${'a'.repeat(DEPLOY_TOKEN.HEX_LENGTH)}`)).toBe(
        TokenKind.DEPLOY_TOKEN,
      );
      expect(classifyToken(`oauth-${'a'.repeat(OAUTH_TOKEN.HEX_LENGTH)}`)).toBe(TokenKind.OAUTH);
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
      expect(TokenKind.OAUTH).toBe(AuthMethod.OAUTH);
      expect(TokenKind.API_KEY).toBe('apiKey');
      expect(TokenKind.DEPLOY_TOKEN).toBe('token');
      expect(TokenKind.OAUTH).toBe('oauth');
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
      expect(() => validateToken('oauth-tooshort')).toThrow(/characters total/);
      // Widths come from the shape constants, never a literal: a hand-written
      // length here would pass while the population it describes had moved.
      expect(validateToken(`ship-${'a'.repeat(API_KEY.HEX_LENGTH)}`)).toBeUndefined();
      expect(validateToken(`deploy-${'b'.repeat(DEPLOY_TOKEN.HEX_LENGTH)}`)).toBeUndefined();
      expect(validateToken(`oauth-${'c'.repeat(OAUTH_TOKEN.HEX_LENGTH)}`)).toBeUndefined();
    });

    it('passes opaque tokens through when non-empty', () => {
      // Deliberately carries NO platform prefix. This row read
      // `'oauth-access-token-value'` until the OAuth population got its shape,
      // at which point it stopped being opaque and started being a malformed
      // member of a real population — which the strict arm above refuses. The
      // lesson generalises: introducing a prefix reclassifies every string
      // that happened to start with it.
      expect(validateToken('a-bearer-of-no-known-population')).toBeUndefined();
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

  it('carries the two channel members the marketplace doors are named for', () => {
    // The derived loop above cannot assert MEMBERSHIP — it iterates whatever
    // the const happens to hold, so deleting a member keeps it green. These
    // two are pinned BY NAME because a hosted-MCP door is named for its via
    // value: `mcp.<domain>/cld` sends `cld` and `/crs` sends `crs`.
    //
    // The failure mode is why it is worth a row: the API drops a via its own
    // types pin does not know, SILENTLY, by design (origin tracking is
    // telemetry and must never fail a deploy). So a convoy that does not reach
    // the API costs attribution and raises nothing anywhere.
    expect(DeploymentVia.CLD).toBe('cld');
    expect(DeploymentVia.CRS).toBe('crs');
    expect(normalizeVia('CLD')).toBe(DeploymentVia.CLD);
    expect(normalizeVia(' crs ')).toBe(DeploymentVia.CRS);
  });

  it('carries both fallbacks', () => {
    // `mcp` = an MCP host with no door of its own; `api` = a call that named
    // nothing at all. Pinned by name for the same reason the channel members
    // are — the derived loop iterates whatever the const happens to hold.
    //
    // `api` was declared one wave AHEAD of its emitter, and the API has
    // stamped it since 2026-08-15. That is the point of adding it early — a
    // member costs a full constellation convoy, so the word ships before the
    // decision that adopts it, never after.
    expect(DeploymentVia.MCP).toBe('mcp');
    expect(DeploymentVia.API).toBe('api');
    expect(normalizeVia('API')).toBe(DeploymentVia.API);
  });

  it('every member is three characters — which is what lets a door path BE its via', () => {
    // The convention that makes channel doors expressible: `/gpt` → 'gpt',
    // `/cld` → 'cld', `/crs` → 'crs'. Nothing else in the platform enforces
    // it, so a four-character member would silently break the one property
    // the door table relies on when it spells a path and an attribution the
    // same way.
    for (const via of Object.values(DeploymentVia)) {
      expect(via).toHaveLength(3);
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

describe('validateTtl — one lifetime grammar, two resources', () => {
  it('accepts a whole number of seconds inside the envelope', () => {
    expect(validateTtl(3600)).toBe(3600);
    expect(validateTtl(TTL_CONSTRAINTS.MIN_SECONDS)).toBe(1);
    expect(validateTtl(TTL_CONSTRAINTS.MAX_SECONDS)).toBe(TTL_CONSTRAINTS.MAX_SECONDS);
  });

  it('reads absence as "no ttl", never as zero', () => {
    // The absent case is the DEFAULT case — every deployment and every token
    // that never expires arrives here — so it must be cheap and total.
    expect(validateTtl(undefined)).toBeUndefined();
    expect(validateTtl(null)).toBeUndefined();
  });

  it('refuses zero, which is how an unset variable arrives', () => {
    // Not merely out of range: a deployment that expires the instant it is
    // created was never live, and `0` is what an empty shell variable
    // coerces to. The floor is 1 for that reason rather than for symmetry.
    expect(() => validateTtl(0)).toThrow(/between/);
  });

  it('refuses a negative duration', () => {
    expect(() => validateTtl(-1)).toThrow(/between/);
    expect(() => validateTtl(-TTL_CONSTRAINTS.MAX_SECONDS)).toThrow(/between/);
  });

  it('refuses a fraction rather than rounding it', () => {
    // Silently choosing 1 or 2 for someone who wrote 1.5 is a decision the
    // platform has no standing to make, and the wire carries integers.
    expect(() => validateTtl(1.5)).toThrow(/whole number/);
    expect(() => validateTtl(0.5)).toThrow(/whole number/);
  });

  it('refuses one second past the ceiling — the boundary, from both sides', () => {
    expect(validateTtl(TTL_CONSTRAINTS.MAX_SECONDS)).toBe(TTL_CONSTRAINTS.MAX_SECONDS);
    expect(() => validateTtl(TTL_CONSTRAINTS.MAX_SECONDS + 1)).toThrow(/between/);
  });

  it('refuses what is not a number at all, including NaN and Infinity', () => {
    // `Number.parseInt('abc')` is NaN, and NaN passes every comparison
    // silently — which is the whole reason the CLI's own parser exists.
    expect(() => validateTtl(Number.NaN)).toThrow(/number of seconds/);
    expect(() => validateTtl(Number.POSITIVE_INFINITY)).toThrow(/number of seconds/);
    expect(() => validateTtl('3600')).toThrow(/number of seconds/);
    expect(() => validateTtl(true)).toThrow(/number of seconds/);
  });

  it('states the ceiling as one year, in the unit it is enforced in', () => {
    // Pinned as a literal rather than recomputed from the constant — a test
    // that repeats the expression passes at any value and holds nothing.
    expect(TTL_CONSTRAINTS.MAX_SECONDS).toBe(31_536_000);
  });

  it('is the same rule the deploy form field names', () => {
    // `ttl` on the multipart body and `ttl` in the options object are one
    // fact; DEPLOY_FIELDS is where the wire spelling lives.
    expect(DEPLOY_FIELDS.TTL).toBe('ttl');
  });
});
