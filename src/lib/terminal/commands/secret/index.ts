import { authenticate, getSessionStatus, logout as signOut } from '@/lib/auth/actions';

import { type OutputNode, text } from '../../output';
import { type Command, type SessionInfo } from '../types';

/**
 * English only and never in the message catalogs (SPEC §10.6).
 */
const AREAS = [
  'profile',
  'links',
  'recommended',
  'projects',
  'experience',
  'education',
  'skills',
  'technologies',
  'practices',
  'contact',
  'resume',
];

export const expired: OutputNode = text('session expired', 'warn');

/**
 * Asks the server; the client's idea of the session is only a hint.
 */
export async function refreshSession(): Promise<null | SessionInfo> {
  const status = await getSessionStatus();

  return status.isAdmin ? { expiresAt: status.expiresAt, base: status.base } : null;
}

// Empty keys: secret commands have no help text (they are never listed).
const base = {
  summaryKey: '',
  usageKey: '',
  group: 'site',
  visibility: 'secret',
} as const;

const su: Command = {
  ...base,
  name: 'su',
  // Any target (or none) behaves the same, so the user name is not revealed.
  async *run(ctx) {
    const password = await ctx.readSecret('Password:');

    if (password === null) return;

    const result = await authenticate(password);

    if (!result.ok) {
      yield text('su: Authentication failure', 'error');

      return;
    }

    ctx.actions.setSession({
      expiresAt: result.expiresAt,
      base: result.redirectTo,
    });
    yield text('Authenticated.', 'success');
    ctx.actions.goTo(result.redirectTo);
  },
};

const admin: Command = {
  ...base,
  name: 'admin',
  requiresSession: true,
  async run(ctx, args) {
    const session = await refreshSession();

    ctx.actions.setSession(session);

    if (!session) return [expired];

    const area = args.positionals[0];

    if (!area) {
      return [
        text('Admin areas:', 'dim'),
        {
          type: 'command',
          items: AREAS.map((name) => ({
            command: `admin ${name}`,
            label: name,
          })),
        },
      ];
    }

    if (!AREAS.includes(area)) {
      return [text(`admin: unknown area ${area}`, 'error')];
    }

    ctx.actions.goTo(`${session.base}/${area}`);

    return [text(`Opening ${area}…`, 'success')];
  },
};

const logout: Command = {
  ...base,
  name: 'logout',
  requiresSession: true,
  async run(ctx) {
    await signOut();
    ctx.actions.setSession(null);

    return [text('Signed out.', 'success')];
  },
};

export const commands: Command[] = [su, admin, logout];
