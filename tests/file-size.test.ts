import { describe, expect, it } from 'vitest';
import { formatFileSize } from '../src/index';

describe('formatFileSize', () => {
  it.each([
    [0, '0 Bytes'],
    [500, '500 Bytes'],
    [1024, '1 KB'],
    [1_234_567, '1.2 MB'],
    [1024 * 1024 * 1.5, '1.5 MB'],
    [1024 * 1024 * 1024 * 2.5, '2.5 GB'],
  ])('reads %i bytes as "%s"', (bytes, words) => {
    expect(formatFileSize(bytes)).toBe(words);
  });

  it('takes the precision a surface asks for', () => {
    expect(formatFileSize(1024 * 1024 * 1.567, 0)).toBe('2 MB');
    expect(formatFileSize(1024 * 1024 * 1.567, 1)).toBe('1.6 MB');
    expect(formatFileSize(1024 * 1024 * 1.567, 3)).toBe('1.567 MB');
  });
});
