/**
 * @file The member-place rule and its sentences, read off the wire's own shape.
 *
 * A place is taken by a member or by a pending invitation, and the two are
 * counted apart because they are undone differently: a member is removed, an
 * invitation is cancelled. Every number here is a planted literal; a test
 * that read the subject's own arithmetic would hold nothing.
 */

import { describe, expect, it } from 'vitest';
import { countPhrase, excessOver, fitPhrase, placesTaken } from '../src/index';

/** Pro's published caps, planted. */
const PRO = { deployments: 1000, platformDomains: 10, customDomains: 3, members: 1 };
/** An account that fits Pro exactly; each row below moves one number. */
const FITS = { deployments: 0, platformDomains: 10, customDomains: 3, members: 1, invitations: 0 };

describe('placesTaken', () => {
  it('counts members and pending invitations together, and nothing else', () => {
    expect(placesTaken({ members: 4, invitations: 1 })).toBe(5);
    expect(placesTaken({ members: 1, invitations: 0 })).toBe(1);
  });
});

describe('excessOver', () => {
  it('answers nothing for an account that fits, exactly at the caps included', () => {
    expect(excessOver(FITS, PRO)).toEqual({});
  });

  it('names members first: a member over the cap has to go whatever else is held', () => {
    expect(excessOver({ ...FITS, members: 5 }, PRO)).toEqual({ members: 4 });
    expect(excessOver({ ...FITS, members: 2, invitations: 1 }, PRO)).toEqual({
      members: 1,
      invitations: 1,
    });
  });

  it('gives invitations the places the members leave, and names the rest', () => {
    expect(excessOver({ ...FITS, invitations: 2 }, PRO)).toEqual({ invitations: 2 });
    expect(excessOver({ ...FITS, members: 3, invitations: 4 }, { ...PRO, members: 5 })).toEqual({
      invitations: 2,
    });
  });

  it('reads each domain kind against its own cap, and never deployments', () => {
    expect(
      excessOver({ ...FITS, deployments: 4999, platformDomains: 12, customDomains: 7 }, PRO),
    ).toEqual({ customDomains: 4, platformDomains: 2 });
  });
});

describe('countPhrase', () => {
  it('words counts people first, each noun agreeing with its count', () => {
    expect(countPhrase({ members: 4 })).toBe('4 members');
    expect(countPhrase({ members: 1, customDomains: 1 })).toBe('1 member and 1 custom domain');
    expect(countPhrase({ members: 3, customDomains: 4, platformDomains: 2 })).toBe(
      '3 members, 4 custom domains and 2 ShipStatic domains',
    );
  });

  it('says nothing for nothing, and never names invitations or deployments', () => {
    expect(countPhrase({})).toBe('');
    expect(countPhrase({ invitations: 2, deployments: 9 })).toBe('');
  });
});

describe('fitPhrase', () => {
  it('removes members and domains, and cancels invitations: two verbs, one phrase', () => {
    expect(fitPhrase({ members: 1, invitations: 1 })).toBe(
      'remove 1 member and cancel 1 invitation',
    );
    expect(fitPhrase({ invitations: 2 })).toBe('cancel 2 invitations');
    expect(fitPhrase({ members: 4, customDomains: 2 })).toBe(
      'remove 4 members and 2 custom domains',
    );
    expect(fitPhrase({ members: 2, customDomains: 1, invitations: 1 })).toBe(
      'remove 2 members and 1 custom domain and cancel 1 invitation',
    );
  });

  it('says nothing for an account that fits', () => {
    expect(fitPhrase({})).toBe('');
    expect(fitPhrase(excessOver(FITS, PRO))).toBe('');
  });
});
