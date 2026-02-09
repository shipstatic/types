import { describe, it, expect } from 'vitest';
import {
  ALLOWED_MIME_TYPES,
  isAllowedMimeType,
  FileValidationStatus,
  TAG_PATTERN,
  TAG_CONSTRAINTS,
  type FileValidationStatusType
} from '../src/index';

describe('Validation Constants - @shipstatic/types', () => {
  describe('ALLOWED_MIME_TYPES', () => {
    it('should have no duplicate entries', () => {
      const seen = new Set<string>();
      const duplicates: string[] = [];

      ALLOWED_MIME_TYPES.forEach(mime => {
        if (seen.has(mime)) {
          duplicates.push(mime);
        }
        seen.add(mime);
      });

      expect(duplicates).toEqual([]);
      expect(seen.size).toBe(ALLOWED_MIME_TYPES.length);
    });

    it('should include common web file types', () => {
      const required = [
        'text/html',
        'text/css',
        'text/plain',
        'application/javascript',
        'application/json',
        'image/', // Prefix for all images
        'audio/', // Prefix for all audio
        'video/', // Prefix for all video
        'font/',  // Prefix for all fonts
      ];

      required.forEach(mime => {
        expect(ALLOWED_MIME_TYPES).toContain(mime);
      });
    });

    it('should block executable MIME types', () => {
      const blocked = [
        'application/x-msdownload',
        'application/x-executable',
        'application/x-sh',
        'application/x-bat',
        'application/exe',
        'application/x-exe',
      ];

      blocked.forEach(mime => {
        expect(ALLOWED_MIME_TYPES).not.toContain(mime);
      });
    });

    it('should include legacy compatibility types', () => {
      const legacy = [
        'application/font-woff',
        'application/x-font-woff',
        'text/javascript', // Legacy but still widely used
      ];

      legacy.forEach(mime => {
        expect(ALLOWED_MIME_TYPES).toContain(mime);
      });
    });

    it('should include modern web formats', () => {
      const modern = [
        'application/wasm',
        'application/manifest+json',
        'model/gltf+json',
        'model/gltf-binary',
      ];

      modern.forEach(mime => {
        expect(ALLOWED_MIME_TYPES).toContain(mime);
      });
    });
  });

  describe('isAllowedMimeType()', () => {
    describe('exact matches', () => {
      it('should allow exact text MIME types', () => {
        expect(isAllowedMimeType('text/html')).toBe(true);
        expect(isAllowedMimeType('text/css')).toBe(true);
        expect(isAllowedMimeType('text/plain')).toBe(true);
        expect(isAllowedMimeType('text/markdown')).toBe(true);
      });

      it('should allow exact application MIME types', () => {
        expect(isAllowedMimeType('application/javascript')).toBe(true);
        expect(isAllowedMimeType('application/json')).toBe(true);
        expect(isAllowedMimeType('application/wasm')).toBe(true);
        expect(isAllowedMimeType('application/pdf')).toBe(true);
      });
    });

    describe('prefix matches', () => {
      it('should allow all image/* types', () => {
        expect(isAllowedMimeType('image/png')).toBe(true);
        expect(isAllowedMimeType('image/jpeg')).toBe(true);
        expect(isAllowedMimeType('image/gif')).toBe(true);
        expect(isAllowedMimeType('image/svg+xml')).toBe(true);
        expect(isAllowedMimeType('image/webp')).toBe(true);
        expect(isAllowedMimeType('image/avif')).toBe(true);
      });

      it('should allow all audio/* types', () => {
        expect(isAllowedMimeType('audio/mpeg')).toBe(true);
        expect(isAllowedMimeType('audio/ogg')).toBe(true);
        expect(isAllowedMimeType('audio/wav')).toBe(true);
        expect(isAllowedMimeType('audio/webm')).toBe(true);
      });

      it('should allow all video/* types', () => {
        expect(isAllowedMimeType('video/mp4')).toBe(true);
        expect(isAllowedMimeType('video/webm')).toBe(true);
        expect(isAllowedMimeType('video/ogg')).toBe(true);
      });

      it('should allow all font/* types', () => {
        expect(isAllowedMimeType('font/woff')).toBe(true);
        expect(isAllowedMimeType('font/woff2')).toBe(true);
        expect(isAllowedMimeType('font/ttf')).toBe(true);
        expect(isAllowedMimeType('font/otf')).toBe(true);
      });
    });

    describe('case sensitivity', () => {
      it('should be case-sensitive (lowercase required)', () => {
        // Correct case
        expect(isAllowedMimeType('text/html')).toBe(true);

        // Wrong case - should fail
        expect(isAllowedMimeType('TEXT/HTML')).toBe(false);
        expect(isAllowedMimeType('Text/Html')).toBe(false);
      });
    });

    describe('security - blocked types', () => {
      it('should block executable MIME types', () => {
        expect(isAllowedMimeType('application/x-msdownload')).toBe(false);
        expect(isAllowedMimeType('application/x-executable')).toBe(false);
        expect(isAllowedMimeType('application/x-sh')).toBe(false);
        expect(isAllowedMimeType('application/x-bat')).toBe(false);
      });

      it('should block script types that could be dangerous', () => {
        expect(isAllowedMimeType('application/x-shellscript')).toBe(false);
        expect(isAllowedMimeType('application/x-perl')).toBe(false);
        expect(isAllowedMimeType('application/x-python')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle MIME types with parameters', () => {
        // MIME with parameters matches because of startsWith() behavior
        // 'text/html; charset=utf-8' starts with 'text/html'
        expect(isAllowedMimeType('text/html; charset=utf-8')).toBe(true);

        // This is CORRECT behavior - no need to strip parameters
        // The startsWith() check naturally handles this
      });

      it('should handle empty string', () => {
        expect(isAllowedMimeType('')).toBe(false);
      });

      it('should handle invalid MIME format', () => {
        expect(isAllowedMimeType('not-a-mime-type')).toBe(false);
        expect(isAllowedMimeType('/')).toBe(false);
      });
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

  describe('TAG_PATTERN', () => {
    it('should match valid tags', () => {
      const valid = [
        'prod',
        'staging',
        'dev',
        'v1.0.0',
        'feature-x',
        'test_env',
        'release.candidate',
      ];

      valid.forEach(tag => {
        expect(TAG_PATTERN.test(tag)).toBe(true);
      });
    });

    it('should reject invalid tag formats', () => {
      // Pattern checks FORMAT only, not length
      const invalidFormat = [
        '-prod',        // Starts with separator
        'prod-',        // Ends with separator
        'pr od',        // Contains space
        'PROD',         // Uppercase
      ];

      invalidFormat.forEach(tag => {
        expect(TAG_PATTERN.test(tag)).toBe(false);
      });
    });

    it('should not enforce length constraints in pattern', () => {
      // Pattern allows any length - length is enforced separately via TAG_CONSTRAINTS
      expect(TAG_PATTERN.test('a')).toBe(true);    // 1 char - passes pattern
      expect(TAG_PATTERN.test('ab')).toBe(true);   // 2 chars - passes pattern
      expect(TAG_PATTERN.test('abc')).toBe(true);  // 3 chars (min) - passes pattern

      // Very long tags pass pattern (but would fail length validation)
      expect(TAG_PATTERN.test('a'.repeat(100))).toBe(true);
    });


    it('should handle separator variations', () => {
      // Pattern should allow these separators
      expect(TAG_PATTERN.test('my-tag')).toBe(true);  // hyphen
      expect(TAG_PATTERN.test('my_tag')).toBe(true);  // underscore
      expect(TAG_PATTERN.test('my.tag')).toBe(true);  // dot
    });
  });

  describe('TAG_CONSTRAINTS', () => {
    it('should define min length', () => {
      expect(TAG_CONSTRAINTS.MIN_LENGTH).toBeGreaterThan(0);
      expect(typeof TAG_CONSTRAINTS.MIN_LENGTH).toBe('number');
    });

    it('should define max length', () => {
      expect(TAG_CONSTRAINTS.MAX_LENGTH).toBeGreaterThan(TAG_CONSTRAINTS.MIN_LENGTH);
      expect(typeof TAG_CONSTRAINTS.MAX_LENGTH).toBe('number');
    });

    it('should define max count', () => {
      expect(TAG_CONSTRAINTS.MAX_COUNT).toBeGreaterThan(0);
      expect(typeof TAG_CONSTRAINTS.MAX_COUNT).toBe('number');
    });

    it('should define allowed separators', () => {
      expect(TAG_CONSTRAINTS.SEPARATORS).toBeDefined();
      expect(TAG_CONSTRAINTS.SEPARATORS.length).toBeGreaterThan(0);
    });

    it('should have reasonable limits', () => {
      // Sanity checks
      expect(TAG_CONSTRAINTS.MIN_LENGTH).toBeGreaterThanOrEqual(1);
      expect(TAG_CONSTRAINTS.MIN_LENGTH).toBeLessThanOrEqual(10);

      expect(TAG_CONSTRAINTS.MAX_LENGTH).toBeGreaterThanOrEqual(10);
      expect(TAG_CONSTRAINTS.MAX_LENGTH).toBeLessThanOrEqual(100);

      expect(TAG_CONSTRAINTS.MAX_COUNT).toBeGreaterThanOrEqual(1);
      expect(TAG_CONSTRAINTS.MAX_COUNT).toBeLessThanOrEqual(100);
    });
  });
});
