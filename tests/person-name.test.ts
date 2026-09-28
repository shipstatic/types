import { describe, expect, it } from 'vitest';
import { personName, personShortName } from '../src/index';

const EMAIL = 'ada@example.com';

describe('personName', () => {
  it('is the name, else the address', () => {
    expect(personName({ name: 'Ada Lovelace', email: EMAIL })).toBe('Ada Lovelace');
    expect(personName({ name: null, email: EMAIL })).toBe(EMAIL);
    expect(personName({ email: EMAIL })).toBe(EMAIL);
  });

  it('treats an empty or whitespace-only name as no name', () => {
    expect(personName({ name: '', email: EMAIL })).toBe(EMAIL);
    expect(personName({ name: '   ', email: EMAIL })).toBe(EMAIL);
    expect(personName({ name: '  Ada  ', email: EMAIL })).toBe('Ada');
  });
});

describe('personShortName', () => {
  it('is the first word of the name, else the whole address', () => {
    expect(personShortName({ name: 'Ada Lovelace', email: EMAIL })).toBe('Ada');
    expect(personShortName({ name: 'Ada', email: EMAIL })).toBe('Ada');
    expect(personShortName({ name: null, email: EMAIL })).toBe(EMAIL);
    expect(personShortName({ name: '   ', email: EMAIL })).toBe(EMAIL);
  });

  it('never shortens an address to its local part', () => {
    expect(personShortName({ name: null, email: 'first last@example.com' })).toBe(
      'first last@example.com',
    );
  });
});
