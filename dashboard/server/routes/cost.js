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

// ROI per day — revenue (sales.amount) minus spend (token_usage.cost_estimate).
// The money number that tells you whether this thing works.
router.get('/roi', (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `WITH days AS (
         SELECT date(created_at) AS day FROM token_usage
         UNION
         SELECT date(claimed_at) AS day FROM sales
       )
       SELECT days.day,
              COALESCE((SELECT SUM(cost_estimate)   FROM token_usage WHERE date(created_at) = days.day), 0) AS spend_usd,
              COALESCE((SELECT SUM(amount)          FROM sales       WHERE date(claimed_at) = days.day), 0) AS revenue_usd
         FROM days
        ORDER BY days.day DESC
        LIMIT 14`,
    )
    .all();
  const totalSpend = rows.reduce((s, r) => s + (r.spend_usd || 0), 0);
  const totalRev = rows.reduce((s, r) => s + (r.revenue_usd || 0), 0);
  res.json({
    days: rows.map((r) => ({
      day: r.day,
      spend: Number((r.spend_usd || 0).toFixed(2)),
      revenue: Number((r.revenue_usd || 0).toFixed(2)),
      profit: Number(((r.revenue_usd || 0) - (r.spend_usd || 0)).toFixed(2)),
    })),
    totals: {
      spend: Number(totalSpend.toFixed(2)),
      revenue: Number(totalRev.toFixed(2)),
      profit: Number((totalRev - totalSpend).toFixed(2)),
    },
  });
});

export default router;
