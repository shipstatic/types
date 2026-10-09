import { describe, expect, it } from 'vitest';
import {
  accountOfPath,
  billingReturnOf,
  consolePaths,
  doorOf,
  doors,
  errandOf,
  isUpgradePath,
  MY_API_KEY_URL,
  SECTIONS,
} from '../src/index';

const ACCOUNT = 'k3v9x2m7q1w8e5r4';

describe('consolePaths', () => {
  const scoped = consolePaths(ACCOUNT);
  const bare = consolePaths();

  it('composes every path inside the account it is bound to', () => {
    expect(scoped.dashboard()).toBe('/k3v9x2m7q1w8e5r4');
    expect(scoped.newSite()).toBe('/k3v9x2m7q1w8e5r4/new');
    expect(scoped.deployments()).toBe('/k3v9x2m7q1w8e5r4/deployments');
    expect(scoped.deployments.upload()).toBe('/k3v9x2m7q1w8e5r4/deployments/upload');
    expect(scoped.domains()).toBe('/k3v9x2m7q1w8e5r4/domains');
    expect(scoped.domains.connect('www.example.com')).toBe(
      '/k3v9x2m7q1w8e5r4/domains/www.example.com/connect',
    );
    expect(scoped.domains.deployment('www.example.com')).toBe(
      '/k3v9x2m7q1w8e5r4/domains/www.example.com/deployment',
    );
    expect(scoped.settings()).toBe('/k3v9x2m7q1w8e5r4/settings');
    expect(scoped.settings('members')).toBe('/k3v9x2m7q1w8e5r4/settings#members');
    expect(scoped.settings('api-key')).toBe('/k3v9x2m7q1w8e5r4/settings#api-key');
    expect(scoped.settingsAfterBilling()).toBe('/k3v9x2m7q1w8e5r4/settings?billing=returned');
    expect(scoped.upgrade()).toBe('/k3v9x2m7q1w8e5r4/upgrade');
    expect(scoped.upgrade('pro')).toBe('/k3v9x2m7q1w8e5r4/upgrade/pro');
    expect(scoped.success()).toBe('/k3v9x2m7q1w8e5r4/success');
    expect(scoped.successAfterCheckout()).toBe('/k3v9x2m7q1w8e5r4/success?upgrading=true');
    expect(scoped.apiKey()).toBe('/k3v9x2m7q1w8e5r4/api-key');
  });

  it('composes the bare form without an account', () => {
    expect(bare.dashboard()).toBe('/');
    expect(bare.newSite()).toBe('/new');
    expect(bare.deployments()).toBe('/deployments');
    expect(bare.deployments.upload()).toBe('/deployments/upload');
    expect(bare.domains()).toBe('/domains');
    expect(bare.domains.connect('www.example.com')).toBe('/domains/www.example.com/connect');
    expect(bare.domains.deployment('www.example.com')).toBe('/domains/www.example.com/deployment');
    expect(bare.settings()).toBe('/settings');
    expect(bare.settings('members')).toBe('/settings#members');
    expect(bare.settingsAfterBilling()).toBe('/settings?billing=returned');
    expect(bare.upgrade()).toBe('/upgrade');
    expect(bare.upgrade('pro')).toBe('/upgrade/pro');
    expect(bare.success()).toBe('/success');
    expect(bare.successAfterCheckout()).toBe('/success?upgrading=true');
    expect(bare.apiKey()).toBe('/api-key');
  });

  it('publishes the API-key link as the bare form on the production console', () => {
    expect(MY_API_KEY_URL).toBe('https://my.shipstatic.com/api-key');
  });
});

describe('SECTIONS', () => {
  it('flags the three sections that mean the reader’s own account', () => {
    const owned = Object.entries(SECTIONS)
      .filter(([, section]) => section.owner)
      .map(([name]) => name);
    expect(owned).toEqual(['upgrade', 'success', 'api-key']);
  });
});

describe('doors', () => {
  it('composes each door', () => {
    expect(doors.login()).toBe('/login');
    expect(doors.login({ next: '/k3v9x2m7q1w8e5r4/upgrade/pro' })).toBe(
      '/login?next=%2Fk3v9x2m7q1w8e5r4%2Fupgrade%2Fpro',
    );
    expect(doors.register()).toBe('/register');
    expect(doors.register({ next: '/claim/abc' })).toBe('/register?next=%2Fclaim%2Fabc');
    expect(doors.logout()).toBe('/logout');
    expect(doors.logout({ next: '/settings' })).toBe('/logout?next=%2Fsettings');
    expect(doors.invitation('inv123')).toBe('/invitation/inv123');
    expect(doors.claim('abc123')).toBe('/claim/abc123');
    expect(doors.consent()).toBe('/consent');
  });

  it("carries the sign-in link's token in the login door's query, beside the journey", () => {
    expect(doors.login({ token: 'tok' })).toBe('/login?token=tok');
    expect(doors.login({ token: 'tok', next: '/invitation/inv1' })).toBe(
      '/login?token=tok&next=%2Finvitation%2Finv1',
    );
    // A query with nothing to say is no query.
    expect(doors.login({ token: undefined, next: undefined })).toBe('/login');
  });
});

describe('the matchers', () => {
  it('read the upgrade section in both forms, and nothing that merely starts like it', () => {
    for (const path of [
      '/upgrade',
      '/upgrade/pro',
      '/UPGRADE/',
      '/upgrade?x=1',
      '/k3v9x2m7q1w8e5r4/upgrade',
      '/k3v9x2m7q1w8e5r4/upgrade/pro#top',
    ]) {
      expect(isUpgradePath(path), path).toBe(true);
    }
    for (const path of ['/upgrades', '/k3v9x2m7q1w8e5r4/upgrades', '/settings', '/', '/admin']) {
      expect(isUpgradePath(path), path).toBe(false);
    }
  });

  it('read the door a path names, as the router matches it', () => {
    expect(doorOf('/login')).toBe('login');
    expect(doorOf('/login?next=%2Fclaim%2Fabc')).toBe('login');
    expect(doorOf('/login?token=tok&next=%2Fclaim%2Fabc')).toBe('login');
    expect(doorOf('/Login/')).toBe('login');
    expect(doorOf('/register')).toBe('register');
    expect(doorOf('/logout')).toBe('logout');
    expect(doorOf('/invitation/inv123')).toBe('invitation');
    expect(doorOf('/Invitation/inv123/')).toBe('invitation');
    expect(doorOf('/claim/abc123')).toBe('claim');
    expect(doorOf('/Claim/abc123/')).toBe('claim');
    expect(doorOf('/consent')).toBe('consent');
  });

  it('read no door from anything that merely resembles one', () => {
    for (const path of [
      '/invitations/inv123',
      '/claims/abc',
      '/k3v9x2m7q1w8e5r4/claim/abc123',
      '/k3v9x2m7q1w8e5r4/invitation/inv123',
      '/',
      '/upgrade',
      '/admin',
    ]) {
      expect(doorOf(path), path).toBeNull();
    }
  });

  it('name the errand a destination carries', () => {
    expect(errandOf('/claim/abc123')).toBe('claim');
    expect(errandOf('/invitation/inv123')).toBe('invite');
    expect(errandOf('/upgrade/pro')).toBe('upgrade');
    expect(errandOf('/k3v9x2m7q1w8e5r4/upgrade/pro')).toBe('upgrade');
    expect(errandOf('/k3v9x2m7q1w8e5r4/settings')).toBeNull();
    expect(errandOf('/login?token=tok&next=%2Fclaim%2Fabc')).toBeNull();
    expect(errandOf('/')).toBeNull();
  });

  it('read the account a path names, and none from a door, the partition or the bare form', () => {
    expect(accountOfPath('/k3v9x2m7q1w8e5r4')).toBe('k3v9x2m7q1w8e5r4');
    expect(accountOfPath('/k3v9x2m7q1w8e5r4/domains/www.example.com/connect')).toBe(
      'k3v9x2m7q1w8e5r4',
    );
    expect(accountOfPath('/foo')).toBe('foo');
    for (const path of ['/', '/domains', '/api-key', '/login', '/claim/abc', '/admin/accounts']) {
      expect(accountOfPath(path), path).toBeNull();
    }
  });

  it('tell the two Stripe returns apart', () => {
    expect(billingReturnOf('?upgrading=true')).toBe('checkout');
    expect(billingReturnOf('?billing=returned')).toBe('portal');
    expect(billingReturnOf('?billing=other')).toBeNull();
    expect(billingReturnOf('')).toBeNull();
  });
});
