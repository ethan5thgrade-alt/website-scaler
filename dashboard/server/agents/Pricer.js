import { BaseAgent } from './BaseAgent.js';
import { getDb, getSetting, setSetting } from '../database.js';

// Cost per 1K tokens by model (must match Accountant)
const COST_PER_1K = {
  'claude-sonnet-4-6': 0.003,
  'gpt-4o': 0.005,
  'gpt-4o-mini': 0.00015,
  default: 0.003,
};

// Fixed costs per business (API calls, not tokens)
const FIXED_COSTS = {
  google_places_search: 0.032,   // Places Text Search: ~$32/1K
  google_places_details: 0.017,  // Details (Contact + Atmosphere + Photos)
  email_send: 0.001,             // SendGrid/Resend per email
};

const MIN_PRICE = 150;   // guaranteed $150 minimum profit per site
const MAX_PRICE = 300;   // cap — we're targeting volume, not whales
const PROFIT_MARGIN = 5; // 5x markup on cost as baseline

export class Pricer extends BaseAgent {
  constructor(broadcast) {
    super('Pricer', broadcast);
    this.priceCache = new Map();
  }

  async start() {
    await super.start();
    // Recalculate prices every 60 seconds
    this.recalcInterval = setInterval(() => this.recalculateGlobalPrice(), 60000);
    this.recalculateGlobalPrice();
  }

  async stop() {
    if (this.recalcInterval) clearInterval(this.recalcInterval);
    await super.stop();
  }

  /**
   * Track cost for a specific business.
   * Called during pipeline for each step.
   */
  trackBusinessCost(businessId, agent, tokens, model = 'default', step = 'unknown') {
    const db = getDb();
    const costPer1K = COST_PER_1K[model] || COST_PER_1K.default;
    const tokenCost = (tokens / 1000) * costPer1K;

    // Add fixed API costs for certain steps
    let apiCost = 0;
    if (step === 'find') apiCost = FIXED_COSTS.google_places_search;
    if (step === 'scrape') apiCost = FIXED_COSTS.google_places_details;
    if (step === 'email') apiCost = FIXED_COSTS.email_send;

    const totalCost = tokenCost + apiCost;

    db.prepare(`
      INSERT INTO business_costs (business_id, agent_name, step, tokens_used, token_cost, api_cost, total_cost, model)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(businessId, agent, step, tokens, tokenCost, apiCost, totalCost, model);

    this.heartbeat();
  }

  /**
   * Calculate the total cost to acquire + build + pitch one business.
   */
  getBusinessCost(businessId) {
    const db = getDb();
    const row = db.prepare(`
      SELECT
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(SUM(tokens_used), 0) as total_tokens,
        COUNT(*) as steps
      FROM business_costs WHERE business_id = ?
    `).get(businessId);

    return {
      businessId,
      totalCost: row.total_cost,
      totalTokens: row.total_tokens,
      steps: row.steps,
    };
  }

  /**
   * Calculate the price to charge for a business's website.
   *
   * Strategy: volume play — send tons of emails, charge small/medium amount.
   * GUARANTEE: at least $150 PROFIT per site (price = cost + $150 minimum).
   * For expensive builds (cost > $30), flag for manual review.
   */
  calculatePrice(businessId) {
    const cost = this.getBusinessCost(businessId);

    // Guarantee $150 profit: price = cost + $150, or 5x markup, whichever is higher
    let price = Math.max(cost.totalCost + MIN_PRICE, cost.totalCost * PROFIT_MARGIN);

    // Flag expensive builds for manual review instead of auto-pricing
    if (cost.totalCost > 30) {
      this.log(`⚠️ Expensive build (biz #${businessId}): cost $${cost.totalCost.toFixed(2)} — needs manual review before pricing`, 'warning');
      this.logIssue(
        `Business #${businessId} cost $${cost.totalCost.toFixed(2)} to build — too expensive for auto-pricing`,
        'warning',
        'Review token usage. Consider simpler prompt or skip this category.'
      );
      // Still set a price but flag it
      price = Math.max(cost.totalCost + MIN_PRICE, MAX_PRICE);
    }

    // Clamp to max
    price = Math.min(MAX_PRICE, price);

    // Round to nearest $5
    price = Math.round(price / 5) * 5;

    // Never below $150
    price = Math.max(MIN_PRICE, price);

    this.priceCache.set(businessId, price);

    return {
      businessId,
      cost: cost.totalCost,
      tokens: cost.totalTokens,
      margin: PROFIT_MARGIN,
      guaranteedProfit: price - cost.totalCost,
      rawPrice: cost.totalCost * PROFIT_MARGIN,
      finalPrice: price,
      needsReview: cost.totalCost > 30,
    };
  }

  /**
   * Recalculate the global average price based on recent businesses.
   * This sets the "current price" for the system.
   */
  recalculateGlobalPrice() {
    const db = getDb();

    // Get average cost per business from the last 50 businesses
    const avg = db.prepare(`
      SELECT
        AVG(biz_total) as avg_cost,
        MIN(biz_total) as min_cost,
        MAX(biz_total) as max_cost,
        COUNT(*) as sample_size
      FROM (
        SELECT business_id, SUM(total_cost) as biz_total
        FROM business_costs
        GROUP BY business_id
        ORDER BY business_id DESC
        LIMIT 50
      )
    `).get();

    if (!avg || !avg.avg_cost || avg.sample_size === 0) {
      // No data yet — use default
      setSetting('current_price', String(MIN_PRICE));
      return;
    }

    // Guarantee $150 profit on average: price = avg cost + $150 min
    let price = Math.max(avg.avg_cost + MIN_PRICE, avg.avg_cost * PROFIT_MARGIN);
    price = Math.min(MAX_PRICE, price);
    price = Math.round(price / 5) * 5;
    price = Math.max(MIN_PRICE, price);

    const oldPrice = parseInt(getSetting('current_price')) || MIN_PRICE;

    setSetting('current_price', String(price));
    setSetting('avg_cost_per_business', String(avg.avg_cost.toFixed(4)));
    setSetting('price_sample_size', String(avg.sample_size));

    if (price !== oldPrice) {
      this.log(`Price updated: $${oldPrice} → $${price} (avg cost: $${avg.avg_cost.toFixed(4)}, ${avg.sample_size} samples, ${PROFIT_MARGIN}x margin)`, 'success');
      this.broadcast('price_update', {
        oldPrice,
        newPrice: price,
        avgCost: avg.avg_cost,
        margin: PROFIT_MARGIN,
        sampleSize: avg.sample_size,
      });
    }

    return {
      currentPrice: price,
      avgCost: avg.avg_cost,
      minCost: avg.min_cost,
      maxCost: avg.max_cost,
      sampleSize: avg.sample_size,
      margin: PROFIT_MARGIN,
    };
  }

  /**
   * Get a full pricing report.
   */
  getReport() {
    const db = getDb();

    const currentPrice = parseInt(getSetting('current_price')) || MIN_PRICE;
    const avgCost = parseFloat(getSetting('avg_cost_per_business')) || 0;
    const sampleSize = parseInt(getSetting('price_sample_size')) || 0;

    // Per-step breakdown
    const byStep = db.prepare(`
      SELECT step,
        COUNT(*) as count,
        AVG(total_cost) as avg_cost,
        SUM(total_cost) as total_cost,
        AVG(tokens_used) as avg_tokens
      FROM business_costs
      GROUP BY step
      ORDER BY total_cost DESC
    `).all();

    // Most expensive businesses
    const mostExpensive = db.prepare(`
      SELECT bc.business_id, b.name, SUM(bc.total_cost) as total_cost, SUM(bc.tokens_used) as tokens
      FROM business_costs bc
      LEFT JOIN businesses b ON b.id = bc.business_id
      GROUP BY bc.business_id
      ORDER BY total_cost DESC
      LIMIT 5
    `).all();

    // Total revenue vs total cost
    const totalRevenue = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM sales').get().total;
    const totalCost = db.prepare('SELECT COALESCE(SUM(total_cost), 0) as total FROM business_costs').get().total;

    return {
      currentPrice,
      avgCostPerBusiness: avgCost,
      sampleSize,
      profitMargin: PROFIT_MARGIN,
      byStep,
      mostExpensive,
      totalRevenue,
      totalCost,
      netProfit: totalRevenue - totalCost,
      profitPercent: totalCost > 0 ? Math.round(((totalRevenue - totalCost) / totalCost) * 100) : 0,
    };
  }
}
