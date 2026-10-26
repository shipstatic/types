import { describe, expect, it } from 'vitest';
import { addressOf, deploymentOf, isAddress, isDeployment } from '../src/index';

/**
 * Deployment addresses: `addressOf`, `deploymentOf`, `isAddress`. Every
 * expected value is a literal, so no assertion consults the rule it tests.
 */

describe('addressOf', () => {
  it('is the deployment id, a dot, then the platform domain', () => {
    expect(addressOf('happy-cat-abc1234', 'statichost.com')).toBe(
      'happy-cat-abc1234.statichost.com',
    );
  });
});

describe('deploymentOf', () => {
  it('reads the first label of an address', () => {
    expect(deploymentOf('happy-cat-abc1234.statichost.com')).toBe('happy-cat-abc1234');
  });

  it('reads a bare deployment id as its own first label', () => {
    expect(deploymentOf('happy-cat-abc1234')).toBe('happy-cat-abc1234');
  });

  it('splits the first label off literally', () => {
    expect(deploymentOf('happy-cat-abc1234.docs.statichost.com')).toBe('happy-cat-abc1234');
    expect(deploymentOf('docs.happy-cat-abc1234.statichost.com')).toBeNull();
  });

  it('is null for a domain, a word and a value that is not a hostname', () => {
    expect(deploymentOf('docs.statichost.com')).toBeNull();
    expect(deploymentOf('maintenance')).toBeNull();
    expect(deploymentOf('null')).toBeNull();
    expect(deploymentOf('{"version":1}')).toBeNull();
  });

  it('holds the label to the deployment grammar exactly', () => {
    expect(deploymentOf('happy-cat-abc123.statichost.com')).toBeNull();
    expect(deploymentOf('happy-cat-abc12345.statichost.com')).toBeNull();
  });
});

describe('isAddress', () => {
  it('is true for one deployment label under this platform domain', () => {
    expect(isAddress('happy-cat-abc1234.statichost.com', 'statichost.com')).toBe(true);
  });

  it('is false under another platform domain', () => {
    expect(isAddress('happy-cat-abc1234.owndomain.site', 'statichost.com')).toBe(false);
  });

  it('is false two labels deep', () => {
    expect(isAddress('happy-cat-abc1234.docs.statichost.com', 'statichost.com')).toBe(false);
  });

  it('is false for the bare id, the apex and a domain', () => {
    expect(isAddress('happy-cat-abc1234', 'statichost.com')).toBe(false);
    expect(isAddress('statichost.com', 'statichost.com')).toBe(false);
    expect(isAddress('docs.statichost.com', 'statichost.com')).toBe(false);
  });

  it('is false for a suffix that only ends like the platform domain', () => {
    expect(isAddress('happy-cat-abc1234.evilstatichost.com', 'statichost.com')).toBe(false);
  });
});

describe('isDeployment, unchanged', () => {
  // The router reads a bare id with it, and the API a full hostname: both
  // forms stay accepted, which is why it is not the address test.
  it('accepts a bare id and a dotted suffix alike', () => {
    expect(isDeployment('happy-cat-abc1234')).toBe(true);
    expect(isDeployment('happy-cat-abc1234.statichost.com')).toBe(true);
    expect(isDeployment('happy-cat-abc1234.docs')).toBe(true);
    expect(isDeployment('docs.statichost.com')).toBe(false);
  });
});
