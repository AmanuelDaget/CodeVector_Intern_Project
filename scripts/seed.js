require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const CATEGORIES = [
  'Electronics', 'Clothing', 'Books', 'Home & Garden',
  'Sports', 'Toys', 'Automotive', 'Food', 'Health', 'Music'
];

const TOTAL = 200_000;
const BATCH_SIZE = 5_000;

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randomDate() {
  const now = Date.now();
  const twoYearsAgo = now - 2 * 365 * 24 * 60 * 60 * 1000;
  return new Date(randomBetween(twoYearsAgo, now)).toISOString();
}

async function seed() {
  const client = await pool.connect();
  console.log(`Seeding ${TOTAL.toLocaleString()} products...`);
  const startTime = Date.now();

  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE products RESTART IDENTITY');

    let inserted = 0;

    while (inserted < TOTAL) {
      const count = Math.min(BATCH_SIZE, TOTAL - inserted);

      const names      = [];
      const categories = [];
      const prices     = [];
      const dates      = [];

      for (let i = 0; i < count; i++) {
        names.push(`Product ${inserted + i + 1}`);
        categories.push(CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]);
        prices.push((randomBetween(1, 999)).toFixed(2));
        dates.push(randomDate());
      }

      await client.query(`
        INSERT INTO products (name, category, price, created_at, updated_at)
        SELECT
          unnest($1::text[]),
          unnest($2::text[]),
          unnest($3::numeric[]),
          unnest($4::timestamptz[]),
          unnest($4::timestamptz[])
      `, [names, categories, prices, dates]);

      inserted += count;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  ${inserted.toLocaleString()} / ${TOTAL.toLocaleString()} — ${elapsed}s elapsed`);
    }

    await client.query('COMMIT');
    console.log(`\nDone! ${TOTAL.toLocaleString()} rows in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();