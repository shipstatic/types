/**
 * @file The console's path grammar: every console path a server producer
 * emits, and the readers that tell those paths apart.
 *
 * One fact, two holders. The console mounts these paths as routes, and the
 * API, its letters and its billing returns emit them as links; a drift
 * between the two is a link that 404s with nothing to report it, and no
 * fence can reach across the two repositories. So the grammar lives here
 * and both import it.
 *
 * The console's URL names the account: every page inside an account lives
 * under `/<account>/`, where `<account>` is the account's id
 * (`Account.account`). Every section is also reachable at the root, where
 * the console opens it in the account the person entered last (or, for a
 * section flagged `owner`, in their own); that bare form is what a producer
 * whose subject is a person emits. Outside both sit the doors, which exist
 * before an account is known, and the operator partition.
 */

import type { AccountPlanType } from './index.js';

/**
 * The sections of an account, by first segment, each mounted twice by the
 * console: under `/<account>/` and at the root.
 *
 * `owner` marks a section that means the person's OWN account: a bare path
 * into it opens the person's own account rather than the one entered last,
 * since a pricing link's `/upgrade/pro` and the published API-key link speak
 * about the reader's plan and key. Modals inside a section carry their own
 * owner rule in the console; this flag is the section's alone.
 */
export const SECTIONS = {
  new: { owner: false },
  deployments: { owner: false },
  domains: { owner: false },
  settings: { owner: false },
  upgrade: { owner: true },
  success: { owner: false },
  'api-key': { owner: true },
} as const satisfies Readonly<Record<string, { readonly owner: boolean }>>;

/** A section's first segment. */
export type ConsoleSection = keyof typeof SECTIONS;

/** The pages that exist before an account is known, by first segment. */
const DOOR_SEGMENTS = ['login', 'register', 'logout', 'invitations', 'claim', 'consent'] as const;
type DoorSegment = (typeof DOOR_SEGMENTS)[number];

/** The operator partition's first segment. */
const ADMIN_SEGMENT = 'admin';

// Sections, doors and the operator partition are disjoint sets of first
// segments: a path's first segment decides which of the three it is, and
// anything that is none of them names an account. A shared name fails the
// build here.
const disjoint: [Extract<ConsoleSection, DoorSegment | typeof ADMIN_SEGMENT>] extends [never]
  ? true
  : never = true;
void disjoint;

/** The two fragments of the settings page a link may name. */
export type SettingsFragment = 'members' | 'api-key';

/**
 * The query markers a Stripe return lands with, each written by a builder
 * below and read by `billingReturnOf`, so neither side spells one.
 */
const BILLING_RETURNS = {
  checkout: ['upgrading', 'true'],
  portal: ['billing', 'returned'],
} as const;
type BillingReturn = keyof typeof BILLING_RETURNS;
const marker = (kind: BillingReturn): string => BILLING_RETURNS[kind].join('=');

/** A link with an optional `?next=`, the console's own return path. */
const withNext = (door: string, next?: string): string =>
  next ? `${door}?next=${encodeURIComponent(next)}` : door;

/**
 * The paths inside one account, or, with no account, the bare form the
 * console opens in the account entered last.
 *
 * ```ts
 * consolePaths(account).domains.connect('www.example.com')
 * // '/<account>/domains/www.example.com/connect'
 * consolePaths().apiKey()
 * // '/api-key'
 * ```
 */
export function consolePaths(account?: string) {
  const base = account ? `/${account}` : '';
  const at = (path: string): string => `${base}${path}`;
  return {
    dashboard: (): string => base || '/',
    newSite: (): string => at('/new'),
    deployments: Object.assign((): string => at('/deployments'), {
      upload: (): string => at('/deployments/upload'),
    }),
    domains: Object.assign((): string => at('/domains'), {
      connect: (domain: string): string => at(`/domains/${domain}/connect`),
      deployment: (domain: string): string => at(`/domains/${domain}/deployment`),
    }),
    settings: (fragment?: SettingsFragment): string =>
      at(fragment ? `/settings#${fragment}` : '/settings'),
    /** Settings, marked as the landing of a Stripe Customer Portal return. */
    settingsAfterBilling: (): string => at(`/settings?${marker('portal')}`),
    upgrade: (plan?: AccountPlanType): string => at(plan ? `/upgrade/${plan}` : '/upgrade'),
    success: (): string => at('/success'),
    /** The success page, marked as the landing of a Stripe Checkout return. */
    successAfterCheckout: (): string => at(`/success?${marker('checkout')}`),
    apiKey: (): string => at('/api-key'),
  };
}

/** The builders `consolePaths` returns. */
export type ConsolePaths = ReturnType<typeof consolePaths>;

/** The doors: the pages that exist before an account is known. */
export const doors = {
  login: (next?: string): string => withNext('/login', next),
  register: (next?: string): string => withNext('/register', next),
  logout: (): string => '/logout',
  invitation: (invitation: string): string => `/invitations/${invitation}`,
  claim: (code: string): string => `/claim/${code}`,
  consent: (): string => '/consent',
} as const;

/**
 * Which Stripe return a query string marks: `checkout` for the success page
 * after Checkout, `portal` for settings after the Customer Portal, or null.
 */
export function billingReturnOf(search: string): BillingReturn | null {
  const params = new URLSearchParams(search);
  for (const [kind, [key, value]] of Object.entries(BILLING_RETURNS)) {
    if (params.get(key) === value) return kind as BillingReturn;
  }
  return null;
}

/**
 * Where a path stands in the grammar. Read the way the console's router
 * matches: case-insensitively, ignoring trailing slashes, the query and the
 * fragment.
 */
type Place =
  | { readonly kind: 'door'; readonly door: DoorSegment }
  | { readonly kind: 'admin' }
  | {
      readonly kind: 'account';
      /** The account the path names, or null for the bare form. */
      readonly account: string | null;
      /** The section, `null` for the dashboard or a path no section owns. */
      readonly section: ConsoleSection | null;
    };

const isDoor = (segment: string): segment is DoorSegment =>
  (DOOR_SEGMENTS as readonly string[]).includes(segment);
const isSection = (segment: string): segment is ConsoleSection => Object.hasOwn(SECTIONS, segment);

function placeOf(path: string): Place {
  const pathname = path.split(/[?#]/)[0].toLowerCase();
  const [first = '', second = ''] = pathname.split('/').filter(Boolean);
  if (isDoor(first)) return { kind: 'door', door: first };
  if (first === ADMIN_SEGMENT) return { kind: 'admin' };
  if (first === '' || isSection(first)) {
    return { kind: 'account', account: null, section: first === '' ? null : first };
  }
  return { kind: 'account', account: first, section: isSection(second) ? second : null };
}

/**
 * The account a path names, or null for a door, the operator partition, or
 * the bare form. Any first segment that is not a section, a door or the
 * partition is an account: the grammar has no other reading, and whether
 * the account exists is the server's answer, never the path's.
 */
export function accountOfPath(path: string): string | null {
  const place = placeOf(path);
  return place.kind === 'account' ? place.account : null;
}

/** Whether a path names a claim link (`/claim/:code`, a bearer credential). */
export const isClaimPath = (path: string): boolean => {
  const place = placeOf(path);
  return place.kind === 'door' && place.door === 'claim';
};

/** Whether a path names an invitation (`/invitations/:invitation`). */
export const isInvitationPath = (path: string): boolean => {
  const place = placeOf(path);
  return place.kind === 'door' && place.door === 'invitations';
};

/**
 * Whether a path names the upgrade section, in either form: `/upgrade`,
 * `/upgrade/:plan`, and the same under `/<account>/`.
 */
export const isUpgradePath = (path: string): boolean => {
  const place = placeOf(path);
  return place.kind === 'account' && place.section === 'upgrade';
};

/** The errand a destination path carries, as the sign-in doors read it. */
export type ConsoleErrand = 'claim' | 'invite' | 'upgrade';

/**
 * The errand a destination path carries, in specificity order: a pricing
 * link is the broadest, and the narrower ones do not normally coexist with
 * it.
 */
export function errandOf(path: string): ConsoleErrand | null {
  if (isClaimPath(path)) return 'claim';
  if (isInvitationPath(path)) return 'invite';
  if (isUpgradePath(path)) return 'upgrade';
  return null;
}
