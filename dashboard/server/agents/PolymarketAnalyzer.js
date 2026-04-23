import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from './BaseAgent.js';
import { getSetting } from '../database.js';
import { logClaudeUsage } from '../services/cost-tracker.js';

// Edge threshold — below this, we don't recommend a trade. Matches the spec.
const EDGE_THRESHOLD_PCT = 15;

const SYSTEM_PROMPT = [
  'You are a specialized Polymarket analyst. Your job is to find edge: prediction-market',
  'prices that diverge from the true probability you can estimate from evidence.',
  '',
  'For each market you receive:',
  '1. Use the web_search tool to gather the most recent news, polling/forecasting data,',
  '   prediction-market commentary, and — critically — contrary evidence that argues',
  '   against the consensus. Do at least 2 searches and read the most relevant sources.',
  '2. Estimate a true probability (0-100%) that the market resolves YES, grounded in',
  '   the evidence you found. Be honest about uncertainty.',
  '3. Compare to the current market price. If |trueProb - yesPrice| > 15 percentage',
  '   points, recommend "Buy YES" (if trueProb > yesPrice) or "Buy NO" (if trueProb <',
  '   yesPrice). Otherwise recommend "Hold".',
  '4. Assign a confidence score 1-10 reflecting data quality: 1 = thin evidence, lots',
  '   of ambiguity; 10 = hard data, clear consensus of independent sources.',
  '',
  'Return ONLY a single valid JSON object, no prose, no markdown fences:',
  '{',
  '  "trueProbability": <number 0-100>,',
  '  "edge": <number, can be negative, = trueProbability - yesPrice>,',
  '  "trade": "Buy YES" | "Buy NO" | "Hold",',
  '  "confidence": <integer 1-10>,',
  '  "reasoning": [<exactly 3 short bullet strings>],',
  '  "sources": [<up to 5 URL strings you actually used>]',
  '}',
].join('\n');

export class PolymarketAnalyzer extends BaseAgent {
  constructor(broadcast) {
    super('PolymarketAnalyzer', broadcast);
  }

  /**
   * Analyze a Polymarket market and return an edge verdict.
   *
   * @param {object} opts
   * @param {string} opts.marketQuestion - e.g. "Will BTC close above $100k on 2026-12-31?"
   * @param {number} opts.yesPrice       - Current YES price as a percent (0-100). Required unless slug given.
   * @param {number} [opts.noPrice]      - Current NO price as a percent. Defaults to 100 - yesPrice.
   * @param {string} [opts.marketSlug]   - Polymarket slug; if given we fetch live prices via gamma-api.
   */
  async analyzeMarket(opts = {}) {
    this.heartbeat();

    let { marketQuestion, yesPrice, noPrice, marketSlug } = opts;

    if (marketSlug) {
      try {
        const live = await this.fetchLiveMarket(marketSlug);
        marketQuestion = marketQuestion || live.question;
        if (yesPrice == null) yesPrice = live.yesPrice;
        if (noPrice == null) noPrice = live.noPrice;
      } catch (err) {
        this.log(`Gamma API fetch failed for "${marketSlug}": ${err.message}`, 'warning');
      }
    }

    if (!marketQuestion || yesPrice == null) {
      throw new Error('marketQuestion and yesPrice are required (or pass marketSlug)');
    }
    if (noPrice == null) noPrice = +(100 - yesPrice).toFixed(2);

    const apiKey = getSetting('anthropic_api_key');
    if (!apiKey) {
      this.log(`Analyzing "${marketQuestion}" [MOCK: add anthropic_api_key for real analysis]`, 'info');
      const verdict = this.mockAnalysis({ marketQuestion, yesPrice, noPrice });
      this.completeTask();
      return { ...verdict, mock: true, marketQuestion, yesPrice, noPrice };
    }

    this.log(`Analyzing "${marketQuestion}" (YES ${yesPrice}% / NO ${noPrice}%)`, 'info');
    const verdict = await this.analyzeWithClaude({ marketQuestion, yesPrice, noPrice, apiKey });
    this.completeTask();
    return { ...verdict, mock: false, marketQuestion, yesPrice, noPrice };
  }

  async fetchLiveMarket(slug) {
    const res = await fetch(`https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error(`gamma-api ${res.status}`);
    const data = await res.json();
    const market = Array.isArray(data) ? data[0] : data?.data?.[0];
    if (!market) throw new Error('market not found');

    // `outcomePrices` comes back as a JSON-encoded string like '["0.62","0.38"]'.
    let prices = market.outcomePrices;
    if (typeof prices === 'string') {
      try { prices = JSON.parse(prices); } catch { prices = []; }
    }
    const yesFrac = Number(prices?.[0]);
    const noFrac = Number(prices?.[1]);

    return {
      question: market.question,
      yesPrice: Number.isFinite(yesFrac) ? +(yesFrac * 100).toFixed(2) : null,
      noPrice: Number.isFinite(noFrac) ? +(noFrac * 100).toFixed(2) : null,
    };
  }

  async analyzeWithClaude({ marketQuestion, yesPrice, noPrice, apiKey }) {
    const client = new Anthropic({ apiKey });
    const model = getSetting('polymarket_analysis_model') || 'claude-sonnet-4-6';

    const userInput = [
      `Market question: ${marketQuestion}`,
      `Current market prices: YES ${yesPrice}% / NO ${noPrice}%`,
      `Today's date: ${new Date().toISOString().slice(0, 10)}`,
      '',
      'Search the web for relevant news, sentiment, and contrary evidence, then return the JSON verdict.',
    ].join('\n');

    let response;
    try {
      response = await client.messages.create({
        model,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
        messages: [{ role: 'user', content: userInput }],
      });
    } catch (err) {
      // Web search tool may not be enabled on the account — retry without it.
      if (/tool|web_search/i.test(err.message)) {
        this.log(`web_search unavailable (${err.message}) — retrying without live search`, 'warning');
        response = await client.messages.create({
          model,
          max_tokens: 1500,
          system: SYSTEM_PROMPT + '\n\nNOTE: web search is unavailable — reason from your training data and be explicit about the resulting uncertainty in your confidence score.',
          messages: [{ role: 'user', content: userInput }],
        });
      } else {
        throw err;
      }
    }

    logClaudeUsage({ agent: this.name, model, usage: response.usage });

    const textBlocks = response.content.filter((b) => b.type === 'text');
    const raw = textBlocks.map((b) => b.text).join('\n').trim();
    const verdict = this.parseVerdict(raw, { yesPrice });

    this.log(
      `"${marketQuestion}" → ${verdict.trade} (true ${verdict.trueProbability}%, edge ${verdict.edge.toFixed(1)}pp, conf ${verdict.confidence}/10)`,
      verdict.trade === 'Hold' ? 'info' : 'success',
    );
    return verdict;
  }

  parseVerdict(raw, { yesPrice }) {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
    // Some models add prose around the JSON — grab the first {...} block.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Claude did not return JSON: ${raw.slice(0, 200)}`);

    const parsed = JSON.parse(match[0]);
    const trueProbability = clampNumber(parsed.trueProbability, 0, 100);
    const confidence = clampNumber(parsed.confidence, 1, 10);
    const reasoning = Array.isArray(parsed.reasoning)
      ? parsed.reasoning.slice(0, 3).map((s) => String(s))
      : [];
    const sources = Array.isArray(parsed.sources)
      ? parsed.sources.slice(0, 5).map((s) => String(s))
      : [];

    const edge = trueProbability - yesPrice;
    const trade =
      edge > EDGE_THRESHOLD_PCT ? 'Buy YES'
      : edge < -EDGE_THRESHOLD_PCT ? 'Buy NO'
      : 'Hold';

    return { trueProbability, edge, trade, confidence, reasoning, sources };
  }

  // Deterministic no-key fallback — produces a plausible-looking verdict from
  // the current price alone so the route stays testable without spending.
  mockAnalysis({ marketQuestion, yesPrice }) {
    const trueProbability = Math.max(0, Math.min(100, Math.round(yesPrice)));
    const edge = 0;
    return {
      trueProbability,
      edge,
      trade: 'Hold',
      confidence: 1,
      reasoning: [
        `Mock mode — no anthropic_api_key configured, so no real research was done.`,
        `Assuming the market price is efficient: true probability ≈ ${trueProbability}%.`,
        `Add an API key in settings to get a real evidence-based analysis of "${marketQuestion}".`,
      ],
      sources: [],
    };
  }
}

function clampNumber(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
