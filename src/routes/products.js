const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/categories', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT DISTINCT category FROM products ORDER BY category'
    );
    res.json(rows.map(r => r.category));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const category = req.query.category || null;

    let cursorCreatedAt = null;
    let cursorId = null;

    if (req.query.cursor) {
      try {
        const decoded = Buffer.from(req.query.cursor, 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);
        cursorCreatedAt = parsed.created_at;
        cursorId = parsed.id;
      } catch {
        return res.status(400).json({ error: 'Invalid cursor' });
      }
    }

    const params = [];
    const conditions = [];

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    if (cursorCreatedAt && cursorId) {
      params.push(cursorCreatedAt);
      params.push(parseInt(cursorId));
      conditions.push(
        `(created_at < $${params.length - 1} OR (created_at = $${params.length - 1} AND id < $${params.length}))`
      );
    }

    params.push(limit + 1);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT id, name, category, price, created_at, updated_at
      FROM products
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT $${params.length}
    `;

    const { rows } = await pool.query(sql, params);

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;

    let nextCursor = null;
    if (hasNextPage) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({ created_at: last.created_at, id: last.id })
      ).toString('base64');
    }

    res.json({
      data: items,
      pagination: {
        limit,
        has_next_page: hasNextPage,
        next_cursor: nextCursor,
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;