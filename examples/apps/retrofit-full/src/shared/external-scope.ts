/**
 * External Agents see a deliberately smaller capability set than the in-page
 * assistant. Keep this list in one place so the page, tests, and deployment
 * configuration can be reviewed against the same contract.
 */
export const EXTERNAL_SCOPE = [
  "northstar/orders.set_note",
  "northstar/open_order@",
  "northstar/close_order",
  "northstar/order_search",
  "northstar/filter_high",
  "northstar/reset_filters",
] as const;
