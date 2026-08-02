/**
 * Vercel serverless function: cloud save/load for Katherine's Island.
 *
 * Routes (same origin, no CORS needed):
 *   GET    /api/save?player=<id>          → read the player's save (404 if none)
 *   PUT    /api/save  { player, state }   → upsert the player's save
 *   DELETE /api/save?player=<id>          → wipe the player's save (reset)
 *
 * Uses the Neon HTTP driver (@neondatabase/serverless) — a stateless,
 * connectionless Postgres client that's ideal for serverless functions.
 * Set `DATABASE_URL` (Neon pooled connection string) in Vercel project env.
 */
import { neon } from '@neondatabase/serverless';

// Lazy-init so an unset DATABASE_URL fails inside the handler (friendly
// 500) instead of throwing at module import.
let sql;
function db() {
  if (!sql) sql = neon(process.env.DATABASE_URL);
  return sql;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(request) {
  // Guard: no DATABASE_URL configured → fail loudly in dev, silently skip
  // on the client (the game falls back to localStorage).
  if (!process.env.DATABASE_URL) {
    return json({ error: 'DATABASE_URL not configured' }, 500);
  }

  const url = new URL(request.url);
  const player = url.searchParams.get('player');

  try {
    if (request.method === 'GET') {
      if (!player) return json({ error: 'player required' }, 400);
      const rows =
        await db()`SELECT state, updated_at FROM saves WHERE player = ${player}`;
      if (rows.length === 0) return json({ save: null }, 404);
      // updatedAt (ms epoch) is the cross-device freshness signal — the
      // client adopts the remote save when it's newer than its last sync.
      return json({
        save: rows[0].state,
        updatedAt: new Date(rows[0].updated_at).getTime(),
      });
    }

    if (request.method === 'PUT') {
      const body = await request.json().catch(() => null);
      if (!body || !body.player || body.state === undefined) {
        return json({ error: 'player and state required' }, 400);
      }
      // Pass the state object directly — postgres.js auto-serializes
      // objects to a jsonb parameter (no cast ambiguity).
      await db()`
        INSERT INTO saves (player, state, updated_at)
        VALUES (${body.player}, ${body.state}, now())
        ON CONFLICT (player)
        DO UPDATE SET state = EXCLUDED.state, updated_at = now()
      `;
      return json({ ok: true });
    }

    if (request.method === 'DELETE') {
      if (!player) return json({ error: 'player required' }, 400);
      await db()`DELETE FROM saves WHERE player = ${player}`;
      return json({ ok: true });
    }

    return json({ error: 'method not allowed' }, 405);
  } catch (err) {
    console.error('save handler error:', err);
    return json({ error: 'database error' }, 500);
  }
}
