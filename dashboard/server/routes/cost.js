// Cost + budget endpoints for the dashboard.

import { Router } from 'express';
import { getDb } from '../database.js';
import {
  getTodaySpendCents,
  getDailyCapCents,
  breakdownToday,
  isOverBudget,
} from '../services/cost-tracker.js';

const router = Router();

router.get('/today', (_req, res) => {
  res.json({
    today_cents: getTodaySpendCents(),
    cap_cents: getDailyCapCents(),
    breakdown: breakdownToday(),
    over_budget: isOverBudget(),
  });
});

router.get('/history', (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT date(created_at) AS day,
              ROUND(SUM(cost_estimate) * 100) AS cents,
              SUM(tokens_used) AS tokens,
              COUNT(*) AS calls
         FROM token_usage
        GROUP BY date(created_at)
        ORDER BY day DESC
        LIMIT 14`,
    )
    .all();
  res.json(rows);
});

export default router;
