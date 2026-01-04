/**
 * Anki Card Splitter - API Server
 */
import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import decks from './routes/decks.js';
import cards from './routes/cards.js';
import split from './routes/split.js';
import backup from './routes/backup.js';
import media from './routes/media.js';
import validate from './routes/validate.js';
import embedding from './routes/embedding.js';
import prompts from './routes/prompts.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type'],
}));

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.route('/api/decks', decks);
app.route('/api/cards', cards);
app.route('/api/split', split);
app.route('/api/backup', backup);
app.route('/api/media', media);
app.route('/api/validate', validate);
app.route('/api/embedding', embedding);
app.route('/api/prompts', prompts);

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ error: err.message || 'Internal server error' }, 500);
});

// Start server
const port = parseInt(process.env.PORT || '3000', 10);

console.log(`🚀 Anki Splitter API Server starting on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
