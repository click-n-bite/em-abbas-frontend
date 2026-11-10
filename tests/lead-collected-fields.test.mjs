import assert from "node:assert/strict";
import test from "node:test";
import {
  groupCollectedFields,
  imageUrlOf,
  mediaIdOf,
  SKIPPED_VALUE,
} from "../src/lib/features/leads/collected-fields.ts";

test("third-party names belong to service answers separately from the customer's identity", () => {
  const result = groupCollectedFields({
    full_name: "Customer",
    mother_name: "Customer mother",
    third_party_name: "Other person",
    third_party_mother_name_or_nickname: "Other mother",
  });

  assert.deepEqual(result.personal, [
    ["full_name", "Customer"],
    ["mother_name", "Customer mother"],
  ]);
  assert.deepEqual(result.service, [
    ["third_party_name", "Other person"],
    ["third_party_mother_name_or_nickname", "Other mother"],
  ]);
});

test("shared profile uses a stable order independently of JSON key order", () => {
  const result = groupCollectedFields({
    marital_status: "متزوج",
    country: "لبنان",
    age: 30,
    full_name: "Sample",
  });
  assert.deepEqual(
    result.personal.map(([key]) => key),
    ["full_name", "age", "country", "marital_status"],
  );
});

test("arbitrary service questions remain visible alongside zero and false answers", () => {
  const result = groupCollectedFields({
    future_question: "A new service answer",
    count: 0,
    confirmed: false,
  });
  assert.deepEqual(result.service, [
    ["future_question", "A new service answer"],
    ["count", 0],
    ["confirmed", false],
  ]);
});

test("service attachments and prior-work attachments never share a gallery", () => {
  const result = groupCollectedFields({
    palm_image: "/media/current",
    prior_contact_photos: ["/media/previous"],
    prior_contact_service: "Previous service",
    contacted_om_abbas: "نعم",
  });
  assert.deepEqual(
    result.servicePhotos.map((photo) => photo.value),
    ["/media/current"],
  );
  assert.deepEqual(
    result.previousPhotos.map((photo) => photo.value),
    ["/media/previous"],
  );
  assert.deepEqual(
    result.contact.map(([key]) => key),
    ["contacted_om_abbas", "prior_contact_service"],
  );
});

test("new service image fields are detected without a service-name allowlist", () => {
  const result = groupCollectedFields({
    new_photo_1: "https://example.test/photo.jpg",
    scan: "/media/scan",
    website_answer: "https://example.test/info",
  });
  assert.deepEqual(
    result.servicePhotos.map((photo) => photo.fieldKey),
    ["new_photo_1", "scan"],
  );
  assert.deepEqual(result.service, [
    ["website_answer", "https://example.test/info"],
  ]);
});

test("empty values and bookkeeping are hidden but skipped answers are retained", () => {
  const result = groupCollectedFields({
    __internal: "secret",
    blank: "   ",
    empty: [],
    missing: null,
    palm_image: SKIPPED_VALUE,
    prior_contact_photos: SKIPPED_VALUE,
  });
  assert.deepEqual(result.service, [["palm_image", SKIPPED_VALUE]]);
  assert.deepEqual(result.contact, [["prior_contact_photos", SKIPPED_VALUE]]);
  assert.equal(result.servicePhotos.length + result.previousPhotos.length, 0);
});

test("duplicate references are removed, unresolved attachments are preserved", () => {
  const result = groupCollectedFields({
    prior_contact_photos: [
      "/media/one",
      "/media/one",
      "wa-image:unresolved",
      null,
    ],
  });
  assert.deepEqual(
    result.previousPhotos.map((photo) => photo.value),
    ["/media/one", "wa-image:unresolved", null],
  );
});

test("legacy image references and scalar photo values remain visible", () => {
  const result = groupCollectedFields({
    cup_image_1: "wa-image:old",
    prior_contact_photos: "https://example.test/old.jpg",
    follows_on_social: "نعم",
  });
  assert.equal(result.servicePhotos[0].value, "wa-image:old");
  assert.equal(result.previousPhotos[0].value, "https://example.test/old.jpg");
  assert.deepEqual(result.personal, [["follows_on_social", "نعم"]]);
});

test("only supported image URL protocols and bounded media IDs are accepted", () => {
  assert.equal(imageUrlOf("javascript:alert(1)"), null);
  assert.equal(mediaIdOf("/media/../private"), null);
  assert.equal(mediaIdOf(" /media/file-id_1/ "), "file-id_1");
});
