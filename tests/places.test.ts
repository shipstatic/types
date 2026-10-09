/**
 * @file The member-place rule, read off the wire's own shape.
 *
 * A place is taken by a member or by a pending invitation, and the two are
 * counted apart because they are undone differently: a member is removed, an
 * invitation is cancelled. Every number here is a planted literal; a test
 * that read the subject's own arithmetic would hold nothing.
 */

import { describe, expect, it } from 'vitest';
import { placesOver, placesTaken } from '../src/index';

describe('placesTaken', () => {
  it('counts members and pending invitations together, and nothing else', () => {
    expect(placesTaken({ members: 4, invitations: 1 })).toBe(5);
    expect(placesTaken({ members: 1, invitations: 0 })).toBe(1);
  });
});

describe('placesOver', () => {
  it('answers zeros for places that fit, exactly at the cap included', () => {
    expect(placesOver({ members: 4, invitations: 1 }, 5)).toEqual({ members: 0, invitations: 0 });
    expect(placesOver({ members: 1, invitations: 0 }, 1)).toEqual({ members: 0, invitations: 0 });
  });

  it('names members first: a member over the cap has to go whatever else is held', () => {
    expect(placesOver({ members: 5, invitations: 0 }, 1)).toEqual({ members: 4, invitations: 0 });
    expect(placesOver({ members: 2, invitations: 1 }, 1)).toEqual({ members: 1, invitations: 1 });
    expect(placesOver({ members: 4, invitations: 1 }, 1)).toEqual({ members: 3, invitations: 1 });
  });

  it('gives invitations the places the members leave, and names the rest', () => {
    expect(placesOver({ members: 1, invitations: 2 }, 1)).toEqual({ members: 0, invitations: 2 });
    expect(placesOver({ members: 3, invitations: 4 }, 5)).toEqual({ members: 0, invitations: 2 });
  });
});
