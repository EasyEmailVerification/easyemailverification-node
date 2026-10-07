// Live tests against the public sandbox (no account, no credits).
import { test } from "node:test";
import assert from "node:assert/strict";
import { EasyEmailVerification, SANDBOX_API_KEY, EEVError, decide } from "../src/index.js";

const eev = new EasyEmailVerification({ apiKey: SANDBOX_API_KEY });
const S = "sandbox.easyemailverification.com";

test("verify: fixed sandbox answers and decisions", async () => {
  const cases = { valid: ["valid", "accept"], invalid: ["invalid", "reject"], unknown: ["unknown", "review"], catchall: ["valid", "review"], disposable: ["valid", "review"] };
  for (const [local, [result, decision]] of Object.entries(cases)) {
    const r = await eev.verify(`${local}@${S}`);
    assert.equal(r.result, result, local);
    assert.equal(decide(r), decision, local);
  }
  const typo = await eev.verify("typo@gmial.com");
  assert.equal(typo.did_you_mean, "typo@gmail.com");
  assert.equal(decide(typo), "suggest");
});

test("verify keeps + in the address", async () => {
  assert.equal((await eev.verify(`valid+tag@${S}`)).email, `valid+tag@${S}`);
});

test("verifyBatch returns one result per address", async () => {
  const r = await eev.verifyBatch([`valid@${S}`, "typo@gmial.com"]);
  assert.deepEqual(r.map(decide), ["accept", "suggest"]);
});

test("verifyBatch refuses more than 50 addresses without calling the API", () => {
  assert.throws(() => eev.verifyBatch(Array(51).fill(`valid@${S}`)), EEVError);
});

test("credits", async () => {
  const c = await eev.credits();
  assert.equal(typeof c.credits_remaining, "number");
});

test("API errors carry the HTTP status", async () => {
  await assert.rejects(eev.verify(`quota@${S}`), (e) => e instanceof EEVError && e.status === 402);
  await assert.rejects(new EasyEmailVerification({ apiKey: "wrong-key" }).verify(`valid@${S}`), (e) => e.status === 401);
});

test("missing key", () => {
  const saved = process.env.EEV_API_KEY;
  delete process.env.EEV_API_KEY;
  assert.throws(() => new EasyEmailVerification(), EEVError);
  if (saved !== undefined) process.env.EEV_API_KEY = saved;
});
