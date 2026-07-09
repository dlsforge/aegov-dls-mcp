/**
 * Stage-1 edge-case suite (test/STAGE1-CHECKLIST.md sections B4, D, E, F).
 * Exercises the REAL built server over stdio. Run: npm run build && npm test
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { connectServer } from "./helpers/mcp.mjs";

let srv;
before(async () => {
  srv = await connectServer();
});
after(async () => {
  await srv.close();
});

const errorsOf = (body) => body.findings.filter((f) => f.level === "error");
const warningsOf = (body) => body.findings.filter((f) => f.level === "warning");

// --- B4: malformed arguments never crash the server -------------------------------

describe("protocol robustness (B4)", () => {
  test("validate_snippet with missing html arg is rejected, server survives", async () => {
    const r = await srv.call("validate_snippet", {});
    assert.ok(r.error || r.res?.isError, "expected a rejection");
    const again = await srv.call("ping", {});
    assert.equal(again.body, "pong");
  });

  test("validate_snippet with empty html is rejected by schema (min 1)", async () => {
    const r = await srv.call("validate_snippet", { html: "" });
    assert.ok(r.error || r.res?.isError, "empty string must not be accepted");
  });

  test("validate_snippet with wrong-typed html is rejected", async () => {
    const r = await srv.call("validate_snippet", { html: 42 });
    assert.ok(r.error || r.res?.isError);
  });
});

// --- D: read-tool edge cases -------------------------------------------------------

describe("getComponent name resolution (D1, D2)", () => {
  for (const name of [".aegov-btn", "BUTTON", "Aegov Btn", "btn"]) {
    test(`'${name}' resolves to aegov-btn`, async () => {
      const { body } = await srv.call("getComponent", { name });
      assert.equal(body.classRoot, "aegov-btn");
    });
  }

  test("member class with underscores 'aegov_check_item' resolves via normalization", async () => {
    const { body } = await srv.call("getComponent", { name: "aegov_check_item" });
    assert.equal(body.classRoot, "aegov-check");
  });

  test("near-miss 'butto' returns isError with didYouMean containing button", async () => {
    const { res, body } = await srv.call("getComponent", { name: "butto" });
    assert.equal(res.isError, true);
    assert.ok(body.didYouMean?.some((k) => k.includes("button")), JSON.stringify(body.didYouMean));
    assert.ok(Array.isArray(body.knownIdentifiers?.componentClassRoots));
  });

  test("empty name returns isError, not a crash", async () => {
    const { res, body } = await srv.call("getComponent", { name: "   " });
    assert.equal(res.isError, true);
    assert.ok(body.error.includes("No catalogue entry"));
  });
});

describe("getTokens edge cases (D3, D4, D5)", () => {
  test("invalid category is rejected by the enum schema", async () => {
    const r = await srv.call("getTokens", { category: "colours" });
    assert.ok(r.error || r.res?.isError);
  });

  test("no-match query returns matched:0 with empty tokens, not an error", async () => {
    const { res, body } = await srv.call("getTokens", { query: "no-such-token-xyz" });
    assert.ok(!res.isError);
    assert.equal(body.matched, 0);
    assert.deepEqual(body.tokens, []);
  });

  test("unfiltered call returns the full token set (223) matching totalByCategory", async () => {
    const { body } = await srv.call("getTokens", {});
    const total = Object.values(body.totalByCategory).reduce((a, b) => a + b, 0);
    assert.equal(body.matched, total);
    assert.equal(body.matched, 223);
    assert.equal(body.tier, "package");
  });

  test("query is case-insensitive ('PRIMARY' === 'primary')", async () => {
    const upper = await srv.call("getTokens", { category: "color", query: "PRIMARY" });
    const lower = await srv.call("getTokens", { category: "color", query: "primary" });
    assert.equal(upper.body.matched, lower.body.matched);
    assert.ok(upper.body.matched > 0);
  });
});

// --- E: scaffolders under every option ---------------------------------------------

describe("scaffoldEmiratesId options (E1, E2, E3)", () => {
  for (const language of ["en", "ar", "both"]) {
    test(`language='${language}' output round-trips validate_snippet clean`, async () => {
      const { body } = await srv.call("scaffoldEmiratesId", { language });
      const v = await srv.call("validate_snippet", { html: body.html });
      assert.equal(v.body.valid, true, JSON.stringify(v.body.findings));
      if (language === "en") {
        assert.ok(!/[؀-ۿ]/.test(body.html), "en output must carry no Arabic");
        assert.equal(body.arabicNote, undefined);
      } else {
        assert.ok(/[؀-ۿ]/.test(body.html), "ar/both output must carry Arabic");
        assert.ok(body.arabicNote, "generated Arabic must be flagged for native review");
      }
      assert.ok(body.html.includes('pattern="^784-\\d{4}-\\d{7}-\\d$"'), "mandatory pattern");
      assert.ok(body.html.includes('dir="ltr"'), "digits input stays LTR");
    });
  }

  test("custom id threads through html and js", async () => {
    const { body } = await srv.call("scaffoldEmiratesId", { id: "applicant-eid" });
    assert.ok(body.html.includes("applicant-eid"));
    assert.ok(body.js.includes("applicant-eid"));
  });

  test("invalid id (starts with digit) is rejected by schema", async () => {
    const r = await srv.call("scaffoldEmiratesId", { id: "1bad" });
    assert.ok(r.error || r.res?.isError);
  });

  test("maskedDisplay:false omits the display block", async () => {
    const { body } = await srv.call("scaffoldEmiratesId", { maskedDisplay: false });
    assert.equal(body.maskedDisplay, undefined);
    assert.ok(body.html, "input html still present");
  });
});

describe("scaffoldUaePass all variant×appearance combos (E4)", () => {
  const WORDING = {
    "sign-in": "Sign in with UAE PASS",
    "sign-up": "Sign up with UAE PASS",
    login: "Login with UAE PASS",
    continue: "Continue with UAE PASS",
    sign: "Sign with UAE PASS",
  };
  for (const variant of Object.keys(WORDING)) {
    for (const appearance of ["black", "white", "outline"]) {
      test(`${variant}/${appearance} emits validating aegov-btn markup`, async () => {
        const { body } = await srv.call("scaffoldUaePass", {
          variant,
          appearance,
          language: "en",
        });
        assert.ok(body.html.en.includes("aegov-btn"), "official button class");
        assert.ok(
          body.html.en.includes(WORDING[variant]),
          `wording for ${variant}: ${body.html.en.slice(0, 200)}`,
        );
        assert.equal(body.html.ar, undefined, "en-only requested");
        const v = await srv.call("validate_snippet", { html: body.html.en });
        assert.equal(v.body.valid, true, JSON.stringify(v.body.findings));
      });
    }
  }
});

describe("scaffoldUaePass language/environment edges (E5, E6)", () => {
  test("ar-only output is RTL and carries no English button title", async () => {
    const { body } = await srv.call("scaffoldUaePass", { language: "ar" });
    assert.equal(body.html.en, undefined);
    assert.ok(body.html.ar.includes('dir="rtl"'));
    assert.ok(/[؀-ۿ]/.test(body.html.ar));
    assert.ok(body.arabicNote, "generated Arabic must be flagged");
    const v = await srv.call("validate_snippet", { html: body.html.ar });
    assert.equal(v.body.valid, true, JSON.stringify(v.body.findings));
  });

  test("staging and production endpoints sit on the documented hosts", async () => {
    const stg = await srv.call("scaffoldUaePass", { environment: "staging" });
    const prod = await srv.call("scaffoldUaePass", { environment: "production" });
    assert.ok(stg.body.oauth.endpoints.authorization.startsWith("https://stg-id.uaepass.ae/"));
    assert.ok(prod.body.oauth.endpoints.authorization.startsWith("https://id.uaepass.ae/"));
    assert.ok(stg.body.oauth.authorizeUrlTemplate.includes("state={{RANDOM_STATE}}"));
  });

  test("invalid variant enum is rejected by schema", async () => {
    const r = await srv.call("scaffoldUaePass", { variant: "register" });
    assert.ok(r.error || r.res?.isError);
  });
});

// --- F: validate_snippet soundness -------------------------------------------------

describe("validate_snippet adversarial regressions (F1-F4)", () => {
  test("F1: EID field identified only by its <label> → error", async () => {
    const { body } = await srv.call("validate_snippet", {
      html:
        '<div class="aegov-form-control"><label for="idn">Emirates ID number</label>' +
        '<div class="form-control-input"><input type="text" id="idn" name="national_id" required /></div></div>',
    });
    assert.equal(body.valid, false);
    assert.ok(errorsOf(body).some((f) => f.message.includes("pattern validation")));
  });

  test("F1 guard: search box labelled 'Search Emirates ID services' NOT flagged", async () => {
    const { body } = await srv.call("validate_snippet", {
      html:
        '<label for="q">Search Emirates ID services</label>' +
        '<input type="search" id="q" name="q" />',
    });
    assert.equal(body.valid, true, JSON.stringify(body.findings));
  });

  test("F2: unmasked full-format EID in content → error (valid:false)", async () => {
    const { body } = await srv.call("validate_snippet", {
      html: '<section class="aegov-card"><p>Emirates ID on file: 784-1985-1234567-1</p></section>',
    });
    assert.equal(body.valid, false);
    assert.ok(errorsOf(body).some((f) => f.message.includes("masked")));
  });

  test("F2 control: masked X-form display stays valid", async () => {
    const { body } = await srv.call("validate_snippet", {
      html: '<section class="aegov-card"><p>Emirates ID on file: 784-1945-XXXXXXX-X</p></section>',
    });
    assert.equal(body.valid, true, JSON.stringify(body.findings));
  });

  test("F3: correct single-quoted pattern accepted", async () => {
    const { body } = await srv.call("validate_snippet", {
      html:
        "<div class=\"aegov-form-control\"><label for=\"eid\">Emirates ID</label>" +
        "<input type=\"text\" id=\"eid\" name=\"emirates-id\" pattern='^784-\\d{4}-\\d{7}-\\d$' required /></div>",
    });
    assert.equal(body.valid, true, JSON.stringify(body.findings));
  });

  test("wrong pattern value → error naming the required pattern", async () => {
    const { body } = await srv.call("validate_snippet", {
      html: '<input type="text" name="emirates-id" pattern="\\d{15}" />',
    });
    assert.equal(body.valid, false);
    assert.ok(errorsOf(body).some((f) => f.message.includes("differs from the required")));
  });

  test("F4: unquoted class=aegov-fake still flagged", async () => {
    const { body } = await srv.call("validate_snippet", {
      html: '<a class=aegov-totally-fake href="#">x</a>',
    });
    assert.equal(body.valid, false);
    assert.ok(errorsOf(body).some((f) => f.message.includes("aegov-totally-fake")));
  });
});

describe("validate_snippet input edges (F5, F6, F7, F8, F9)", () => {
  test("whitespace-only input returns a well-formed valid result", async () => {
    const { body } = await srv.call("validate_snippet", { html: "   \n\t  " });
    assert.equal(body.valid, true);
    assert.deepEqual(body.findings, []);
  });

  test("plain text (no markup) does not crash and validates trivially", async () => {
    const { body } = await srv.call("validate_snippet", { html: "just some words, no tags" });
    assert.equal(body.valid, true);
  });

  test("F6: Bootstrap classes → info 'unverified', not an error", async () => {
    const { body } = await srv.call("validate_snippet", {
      html: '<button class="btn btn-primary-xyz" type="button">x</button>',
    });
    assert.equal(errorsOf(body).length, 0);
    assert.ok(body.classes.unverified.includes("btn-primary-xyz"));
    assert.ok(body.findings.some((f) => f.level === "info" && f.message.includes("cannot verify")));
  });

  test("F7: unknown aegov-* class carries a did-you-mean suggestion", async () => {
    // Note: suggestions are substring-based against class names, so 'aegov-btnn'
    // suggests aegov-btn, but the docs-name-derived typo 'aegov-button' would not
    // (recorded as finding T1 in the Stage-1 test report — error still fires).
    const { body } = await srv.call("validate_snippet", {
      html: '<button class="aegov-btnn" type="button">x</button>',
    });
    assert.equal(body.valid, false);
    assert.ok(errorsOf(body).some((f) => f.message.includes("Did you mean") && f.message.includes("aegov-btn")));
  });

  test("F8: img-without-alt error / button-without-type warning / Arabic-without-rtl warning", async () => {
    const { body } = await srv.call("validate_snippet", {
      html: '<img src="x.png"><button>اضغط هنا</button>',
    });
    assert.ok(errorsOf(body).some((f) => f.message.includes("alt")));
    assert.ok(warningsOf(body).some((f) => f.message.includes("type")));
    assert.ok(warningsOf(body).some((f) => f.message.includes("rtl")));
  });

  test("F8 control: Arabic inside dir=\"rtl\" raises no RTL warning", async () => {
    const { body } = await srv.call("validate_snippet", {
      html: '<div dir="rtl"><p>مرحبا</p></div>',
    });
    assert.ok(!warningsOf(body).some((f) => f.message.includes("rtl")));
  });

  test("F9: ~200KB input answers without crashing", async () => {
    const big =
      '<div class="aegov-card">' +
      '<button class="aegov-btn" type="button">salam</button>'.repeat(4000) +
      "</div>";
    assert.ok(big.length > 190_000);
    const { body } = await srv.call("validate_snippet", { html: big });
    assert.equal(body.valid, true, body.summary);
    const again = await srv.call("ping", {});
    assert.equal(again.body, "pong");
  });
});
