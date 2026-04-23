// AppFolio funnel automation.
//
// What it is: a preset for the main pipeline that targets independent
// landlords and small property-management companies — the exact segment
// AppFolio wants at the top of its funnel. Scout searches for PM companies
// without websites, Builder uses the trust-navy style, and Postman picks
// from the property_management email templates that namecheck AppFolio as
// the natural upgrade once the prospect outgrows a static landing page.
//
// Why it lives outside the generic pipeline config: the goal isn't just
// "another category." It's a repeatable, single-call preset the operator
// can kick off against any set of ZIPs (e.g., common rental markets) with
// sane defaults — no memorizing categories, limits, or copy variants.

const DEFAULT_ZIPS = [
  '94102', // San Francisco, CA
  '90401', // Santa Monica, CA
  '78701', // Austin, TX
  '33130', // Miami, FL
  '80202', // Denver, CO
];

const DEFAULT_MAX_LEADS = 25;
const DEFAULT_DAILY_EMAIL_LIMIT = 50;

export function buildAppFolioRunConfig(overrides = {}) {
  const zipCodes = Array.isArray(overrides.zipCodes) && overrides.zipCodes.length > 0
    ? overrides.zipCodes
    : DEFAULT_ZIPS;
  const maxLeads = Number.isFinite(overrides.maxLeads) ? overrides.maxLeads : DEFAULT_MAX_LEADS;
  const dailyEmailLimit = Number.isFinite(overrides.dailyEmailLimit)
    ? overrides.dailyEmailLimit
    : DEFAULT_DAILY_EMAIL_LIMIT;

  return {
    automation: 'appfolio',
    zipCodes,
    categories: ['property_management'],
    maxLeads,
    dailyEmailLimit,
  };
}
