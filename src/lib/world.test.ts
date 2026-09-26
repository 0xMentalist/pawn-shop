import assert from "node:assert/strict";
import test from "node:test";
import { hasVerifiedWorldCredential, normalizeWorldCredential, requestedWorldCredential } from "./world";

test("accepts only the intended World ID 4 credential and issuer schema pairs", () => {
  assert.equal(requestedWorldCredential({ identifier: "proof_of_human", issuer_schema_id: 1 }), "proof_of_human");
  assert.equal(requestedWorldCredential({ identifier: "passport", issuer_schema_id: 9303 }), "passport");
  assert.equal(requestedWorldCredential({ identifier: "mnc", issuer_schema_id: 9310 }), "mnc");
  assert.equal(requestedWorldCredential({ identifier: "selfie", issuer_schema_id: 11 }), "selfie");
  assert.equal(requestedWorldCredential({ identifier: "face", issuer_schema_id: 11 }), "selfie");
  assert.equal(requestedWorldCredential({ identifier: "passport", issuer_schema_id: 1 }), null);
  assert.equal(requestedWorldCredential({ identifier: "device", issuer_schema_id: 1 }), null);
  assert.equal(requestedWorldCredential({ identifier: "selfie" }), null);
});

test("normalizes World's face identifier without accepting unrelated credentials", () => {
  assert.equal(normalizeWorldCredential("face"), "selfie");
  assert.equal(normalizeWorldCredential("document"), null);
  assert.equal(normalizeWorldCredential(undefined), null);
});

test("requires a successful server-verified result for the same credential and nullifier", () => {
  assert.equal(hasVerifiedWorldCredential([{ identifier: "face", success: true, nullifier: "0x01" }], "selfie", "0x1"), true);
  assert.equal(hasVerifiedWorldCredential([{ identifier: "passport", success: true, nullifier: "0x01" }], "selfie", "0x1"), false);
  assert.equal(hasVerifiedWorldCredential([{ identifier: "selfie", success: false, nullifier: "0x01" }], "selfie", "0x1"), false);
  assert.equal(hasVerifiedWorldCredential([{ identifier: "selfie", success: true, nullifier: "0x02" }], "selfie", "0x1"), false);
  assert.equal(hasVerifiedWorldCredential([{ identifier: "selfie", success: true, nullifier: "not-hex" }], "selfie", "0x1"), false);
});
