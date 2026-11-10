import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// This dependency-free helper can be tested on CI's Node 20 without a TS loader.
const source = await readFile(
  new URL("../src/lib/channel-identity.ts", import.meta.url),
  "utf8",
);

const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;

const {
  contactIdentifier,
  contactName,
  contactSearchText,
  reconcileConversationBlock,
} = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);

test("legacy phone contacts retain labels and explicit names", () => {
  assert.equal(
    contactIdentifier({ id: "chat", phone: "96171123456" }),
    "96171123456",
  );
  assert.equal(contactName({ phone: "96171123456", customerName: " A " }), "A");
});

test("opaque and numeric user IDs are preserved without manufacturing a phone", () => {
  for (const user of ["AbC.970123:opaque_-9", "970123456789"]) {
    const contact = {
      id: "chat",
      channel: "whatsapp",
      phone: null,
      externalUserType: "user_id",
      externalUserId: user,
    };

    assert.equal(contactName(contact), user);
    assert.equal(contactIdentifier(contact), user);
    assert.equal(contact.phone, null);
    assert.ok(contactSearchText(contact).includes(user.toLowerCase()));
  }
});

test("canonical conversation and business connection remain searchable", () => {
  const contact = { id: "chat-A", connectionId: "Business-B", phone: null };

  assert.equal(contactIdentifier(contact), "chat-A");
  assert.ok(contactSearchText(contact).includes("business-b"));
  assert.ok(contactSearchText(contact).includes("chat-a"));
});

test("phone block overlays cannot erase or reinstate an authoritative API block", () => {
  const blocked = { phone: null, blocked: true, identityBlocked: true };

  assert.equal(reconcileConversationBlock(blocked), blocked);
  const cleared = {
    phone: "96171123456",
    blocked: false,
    identityBlocked: false,
  };

  assert.equal(
    reconcileConversationBlock(cleared, { whatsappStatus: "blocked" }),
    cleared,
  );
  assert.equal(
    reconcileConversationBlock({ phone: null, identityBlocked: true }).blocked,
    true,
  );
  assert.equal(
    reconcileConversationBlock(
      { phone: "96171123456" },
      { whatsappStatus: "blocked" },
    ).blocked,
    true,
  );
});
