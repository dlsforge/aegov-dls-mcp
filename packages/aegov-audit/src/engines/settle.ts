/**
 * Wait out client-side redirect chains before any engine touches the page.
 * Real gov sites navigate after load (fnrc.gov.ae: / → /portal/home/index,
 * then re-navigates once more ~2 s later; culture-switch endpoints bounce
 * through a cookie-set redirect) — engines that start too early die with
 * "Execution context was destroyed". Settled = the URL survived one 3 s
 * window unchanged (bounded at 30 s), then network quiet if it comes.
 */
import type { Page } from "playwright";

export async function settleNavigation(page: Page): Promise<void> {
  const started = Date.now();
  let stableUrl = page.url();
  while (Date.now() - started < 30_000) {
    await page.waitForTimeout(3_000);
    if (page.url() === stableUrl) break;
    stableUrl = page.url();
    await page.waitForLoadState("load", { timeout: 30_000 }).catch(() => {});
  }
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}
