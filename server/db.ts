import pg from 'pg';

// Return DATE columns as 'YYYY-MM-DD' instead of a JS Date shifted by the server timezone.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

export const pool = new pg.Pool({
  connectionString,
  // Serverless functions each hold their own pool; keep it small so Neon's connection limit holds.
  max: 3,
});
