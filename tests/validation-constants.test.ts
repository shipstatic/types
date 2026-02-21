import { describe, it, expect } from 'vitest';
import {
  BLOCKED_EXTENSIONS,
  isBlockedExtension,
  FileValidationStatus,
  LABEL_PATTERN,
  LABEL_CONSTRAINTS,
  type ConfigResponse,
  type FileValidationStatusType
} from '../src/index';

describe('Validation Constants - @shipstatic/types', () => {
  describe('BLOCKED_EXTENSIONS', () => {
    it('should block executable extensions', () => {
      const executables = ['exe', 'msi', 'dll', 'scr', 'bat', 'cmd', 'com', 'pif', 'app', 'deb', 'rpm'];
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
      const webExtensions = ['html', 'css', 'js', 'json', 'png', 'jpg', 'svg', 'woff2', 'pdf', 'wasm'];
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

  describe('ConfigResponse', () => {
    it('should have correct shape with 3 fields', () => {
      const config: ConfigResponse = {
        maxFileSize: 20 * 1024 * 1024,
        maxFilesCount: 500,
        maxTotalSize: 50 * 1024 * 1024,
      };

      expect(typeof config.maxFileSize).toBe('number');
      expect(typeof config.maxFilesCount).toBe('number');
      expect(typeof config.maxTotalSize).toBe('number');
    });

    it('should only contain numeric limit fields', () => {
      const config: ConfigResponse = {
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

      valid.forEach(label => {
        expect(LABEL_PATTERN.test(label)).toBe(true);
      });
    });

    it('should reject invalid label formats', () => {
      const invalidFormat = [
        '-prod',
        'prod-',
        'pr od',
        'PROD',
      ];

      invalidFormat.forEach(label => {
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
});
