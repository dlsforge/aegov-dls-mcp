/**
 * Mandatory UAE Pass wherever a login exists (STAGE2-HANDOFF §6 step 4,
 * non-negotiable §7).
 *
 * Conservative on purpose: only flags when the page carries a REAL login
 * surface — a password input, or an explicit login/sign-in control — and no
 * UAE Pass signal (uaepass.ae reference, "UAE PASS" text/asset) anywhere.
 * Heuristic confidence: a human confirms whether the login is a citizen
 * -facing service login (UAE Pass mandatory) or an internal/staff login.
 */
import type { Page } from "playwright";
import type { AuditFinding } from "../report/types.js";

type LoginScan = {
  passwordInputs: number;
  loginControls: string[];
  uaePassSignals: string[];
};

export async function runUaePassCheck(page: Page): Promise<AuditFinding[]> {
  const scan = (await page.evaluate(() => {
    const loginText = /\b(log ?in|sign ?in)\b|تسجيل الدخول/i;
    const uaePassText = /uae ?pass|uaepass/i;

    const loginControls: string[] = [];
    for (const el of document.querySelectorAll("a, button")) {
      const text = (el.textContent ?? "").trim().slice(0, 60);
      const href = el.getAttribute("href") ?? "";
      if (loginText.test(text) || /\/(log|sign)-?in\b/i.test(href)) {
        if (loginControls.length < 5) loginControls.push(text || href);
      }
    }

    const uaePassSignals: string[] = [];
    for (const el of document.querySelectorAll("a, button, img, form")) {
      const blob = [
        el.textContent ?? "",
        el.getAttribute("href") ?? "",
        el.getAttribute("src") ?? "",
        el.getAttribute("alt") ?? "",
        el.getAttribute("action") ?? "",
      ].join(" ");
      if (uaePassText.test(blob)) {
        if (uaePassSignals.length < 5)
          uaePassSignals.push((el.textContent ?? el.getAttribute("href") ?? "").trim().slice(0, 60));
      }
    }

    return {
      passwordInputs: document.querySelectorAll('input[type="password"]').length,
      loginControls,
      uaePassSignals,
    };
  })) as LoginScan;

  const hasLogin = scan.passwordInputs > 0 || scan.loginControls.length > 0;
  if (!hasLogin || scan.uaePassSignals.length > 0) return [];

  const evidence =
    scan.passwordInputs > 0
      ? `${scan.passwordInputs} password input(s)`
      : `login control(s): ${scan.loginControls.join(" | ")}`;
  return [
    {
      engine: "dls",
      ruleId: "dls-uaepass-missing",
      severity: "serious",
      confidence: "heuristic",
      message:
        `A login surface exists (${evidence}) but no UAE Pass signal was found anywhere on the ` +
        `page. UAE Pass is mandatory for citizen-facing government logins — confirm whether ` +
        `this login is in scope, then integrate UAE Pass.`,
      fix: "Integrate UAE Pass as the (primary) authentication route for this login.",
      helpUrl: "https://docs.uaepass.ae/",
      tags: ["aegov-dls", "uae-pass"],
      targets: scan.loginControls.slice(0, 5),
      nodeCount: scan.passwordInputs + scan.loginControls.length,
    },
  ];
}
