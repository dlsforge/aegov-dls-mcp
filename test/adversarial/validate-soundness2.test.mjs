/**
 * Adversarial pass — validate_snippet soundness gaps BEYOND the fixed F1-F4:
 * the fixes handled quoting variants but not CASE variants (HTML attribute
 * names are case-insensitive), and F1's label association handles only quoted
 * for=/id=. Each failing test here is a live defect, asserted as the CORRECT
 * behaviour so the fix flips it green.
 *
 * Run: npm run build && node --test test/adversarial/validate-soundness2.test.mjs
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { connectServer } from "../helpers/mcp.mjs";

let srv;
before(async () => {
  srv = await connectServer();
});
after(async () => {
  await srv.close();
});

const errorsOf = (b) => b.findings.filter((f) => f.level === "error");
const warningsOf = (b) => b.findings.filter((f) => f.level === "warning");

describe("attribute-name case-insensitivity (HTML allows PATTERN=, ALT=, TYPE=)", () => {
  test("uppercase PATTERN= with the exactly-correct value must NOT be flagged as missing", async () => {
    const { body } = await srv.call("validate_snippet", {
      html:
        '<div class="aegov-form-control"><label for="eid">Emirates ID</label>' +
        '<input type="text" id="eid" name="emirates-id" PATTERN="^784-\\d{4}-\\d{7}-\\d$" required /></div>',
    });
    assert.equal(body.valid, true, JSON.stringify(body.findings));
  });

  test("uppercase ALT= on an <img> must NOT raise the missing-alt error", async () => {
    const { body } = await srv.call("validate_snippet", {
      html: '<img src="x.png" ALT="Ministry logo">',
    });
    assert.ok(
      !errorsOf(body).some((f) => f.message.includes("alt")),
      JSON.stringify(body.findings),
    );
  });

  test("uppercase TYPE= on a <button> must NOT raise the missing-type warning", async () => {
    const { body } = await srv.call("validate_snippet", {
      html: '<button TYPE="button" class="aegov-btn">x</button>',
    });
    assert.ok(
      !warningsOf(body).some((f) => f.message.includes("type")),
      JSON.stringify(body.findings),
    );
  });
});

describe("unquoted-attribute parity (F3/F4 fixed the quoted forms only)", () => {
  test("unquoted pattern=^784-… (HTML5-valid) must NOT be flagged as missing", async () => {
    const { body } = await srv.call("validate_snippet", {
      html:
        '<input type="text" name="emirates-id" pattern=^784-\\d{4}-\\d{7}-\\d$ required />',
    });
    assert.equal(body.valid, true, JSON.stringify(body.findings));
  });

  test("EID field with unquoted for=/id= must still be recognised via its label (F1 family)", async () => {
    const { body } = await srv.call("validate_snippet", {
      html:
        '<div class="aegov-form-control"><label for=idn>Emirates ID number</label>' +
        '<div class="form-control-input"><input type="text" id=idn name="national_id" required /></div></div>',
    });
    assert.equal(body.valid, false, "an EID field without pattern validation must be an error");
    assert.ok(errorsOf(body).some((f) => f.message.includes("pattern validation")));
  });

  test("EID field labelled via aria-labelledby must be recognised (F1 family)", async () => {
    // NB: the referenced id must not itself contain an EID signal ("eid"/"784"),
    // otherwise the input tag matches EID_SIGNAL_RE by accident and the test
    // proves nothing about aria-labelledby resolution.
    const { body } = await srv.call("validate_snippet", {
      html:
        '<div class="aegov-form-control"><span id="idnum-label">Emirates ID number</span>' +
        '<input type="text" aria-labelledby="idnum-label" name="national_id" required /></div>',
    });
    assert.equal(body.valid, false, "an EID field without pattern validation must be an error");
  });
});
