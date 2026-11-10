import assert from "node:assert/strict";
import test from "node:test";
// Node's native TypeScript loader requires the explicit file extension.
// eslint-disable-next-line import/extensions
import { countryName, phoneCountryOf } from "../src/lib/countries.ts";

test("recognizes stored and formatted international phone numbers", () => {
  for (const phone of ["96171123456", "+961 71 123 456", "0096171123456"]) {
    assert.equal(phoneCountryOf(phone), "LB");
  }
  assert.equal(countryName("LB", "en"), "Lebanon");
  assert.equal(countryName("LB", "ar"), "لبنان");
});

test("shared calling codes use the complete number", () => {
  assert.equal(phoneCountryOf("+14165551234"), "CA");
  assert.equal(phoneCountryOf("+12025551234"), "US");
});

test("missing, local, invalid and non-geographic numbers have no guessed country", () => {
  for (const phone of [
    null,
    undefined,
    "",
    "071123456",
    "not a number",
    "+961",
    "0000000000",
    "+80012345678",
  ]) {
    assert.equal(phoneCountryOf(phone), null, String(phone));
  }
});
