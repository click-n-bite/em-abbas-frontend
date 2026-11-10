/** Synthetic API responses only: never sends a real message or changes an account. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright",
);

const base = process.env.LEAD_PREVIEW_URL ?? "http://127.0.0.1:3107";

const origin = new URL(base).origin;

const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  for (const [locale, width, role, user] of [
    ["en", 1440, "admin", "AbC.970123:opaque_-9"],
    ["ar", 390, "admin", "96171123456"],
    ["en", 1440, "agent", "Opaque.sender_9"],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      serviceWorkers: "block",
    });

    const calls = [];

    const errors = [];

    const messages = [];

    let conversation = {
      id: "457e22b0-e1fc-4c8e-8bcc-a902b623e440",
      contractVersion: 2,
      customerId: 42,
      channel: "whatsapp",
      connectionId: "business-two",
      phone: null,
      whatsappUserId: user,
      externalUserType: "user_id",
      externalUserId: user,
      replyDestinationType: "user_id",
      replyDestinationId: user,
      customerName: null,
      metaCustomerName: null,
      nameOverridden: false,
      mode: "bot",
      assigneeId: null,
      preview: "Synthetic inbound",
      unreadCount: 0,
      lastMessageAt: "2026-11-06T12:00:00Z",
      blocked: false,
      identityBlocked: false,
      identityBlockSource: null,
      identityBlockExpiresAt: null,
      serviceWindowOpen: true,
    };

    await context.addInitScript(
      ({ locale, role }) => {
        localStorage.setItem("ema.token", "preview-token");
        localStorage.setItem("ema.locale", locale);
        localStorage.setItem(
          "ema.agent",
          JSON.stringify({
            id: "42",
            name: "Preview staff",
            role,
            expiresAt: Date.now() + 3_600_000,
          }),
        );
      },
      { locale, role },
    );
    await context.route("**/*", async (route) => {
      const request = route.request();

      const url = new URL(request.url());

      if (url.origin === origin && !url.pathname.startsWith("/api/"))
        return route.continue();

      const path = url.pathname;

      if (request.method() !== "GET")
        calls.push({
          path,
          method: request.method(),
          body: request.postDataJSON(),
        });

      if (path.includes("/ws"))
        return route.fulfill({ status: 503, body: "Preview" });

      if (path === "/conversations")
        return route.fulfill({ json: [conversation] });

      if (path === `/conversations/${conversation.id}`)
        return route.fulfill({ json: conversation });

      if (path.endsWith("/takeover")) {
        conversation = { ...conversation, mode: "agent", assigneeId: "42" };

        return route.fulfill({ json: conversation });
      }

      if (path.endsWith("/identity-block")) {
        const blocked = request.postDataJSON().blocked;

        conversation = {
          ...conversation,
          blocked,
          identityBlocked: blocked,
          identityBlockSource: blocked ? "admin" : null,
        };

        return route.fulfill({ json: conversation });
      }

      if (path.endsWith("/messages")) {
        if (request.method() === "POST") {
          const body = request.postDataJSON();

          messages.push({
            ...body,
            id: "message-one",
            conversationId: conversation.id,
            createdAt: new Date().toISOString(),
            direction: "outbound",
            source: "agent",
            status: "sent",
            mediaId: null,
            mediaUrl: null,
          });

          return route.fulfill({ json: messages.at(-1) });
        }

        return route.fulfill({ json: messages });
      }

      if (path === "/api/leads/services")
        return route.fulfill({
          json: [{ id: 1, key: "palm_reading", name: "Palm reading" }],
        });

      if (path === "/api/leads")
        return route.fulfill({
          json: {
            items: [
              {
                ...conversation,
                id: 81,
                conversationId: conversation.id,
                status: "open",
                source: "ai",
                serviceId: 1,
                serviceKey: "palm_reading",
                serviceName: "Palm reading",
                collectedFields: {},
                note: null,
                createdBy: null,
                closedBy: null,
                closeNote: null,
                closedAt: null,
                createdAt: "2026-11-06T12:00:00Z",
                updatedAt: "2026-11-06T12:00:00Z",
              },
            ],
            page: 0,
            size: 20,
            total: 1,
            totalPages: 1,
          },
        });

      return route.fulfill({ json: { data: [], unreadCount: 0 } });
    });

    try {
      const page = await context.newPage();

      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${base}/conversations?id=${conversation.id}`);
      await page
        .locator("header")
        .getByText(user, { exact: true })
        .first()
        .waitFor();
      assert.equal(
        await page.locator("header [class*='fi-lb']").count(),
        0,
        "numeric user ID must not imply a country",
      );

      if (role === "agent") {
        await page
          .getByRole("button", {
            name: locale === "ar" ? "تولي المحادثة" : "Take over",
            exact: true,
          })
          .click();
        const input = page.locator("textarea").first();

        await input.fill("Synthetic reply");
        await page
          .getByRole("button", {
            name: locale === "ar" ? "إرسال" : "Send",
            exact: true,
          })
          .click();
        await page
          .getByText("Synthetic reply", { exact: true })
          .first()
          .waitFor();
        const sent = calls.find(
          (call) => call.path.endsWith("/messages") && call.method === "POST",
        );

        assert.ok(sent.path.includes(conversation.id));
        assert.equal(sent.body.text, "Synthetic reply");
        assert.equal("phone" in sent.body, false);
      }

      await page
        .getByRole("button", {
          name: locale === "ar" ? "المزيد من الإجراءات" : "More actions",
          exact: true,
        })
        .click();
      const block = page
        .getByRole("menuitem")
        .filter({
          hasText: locale === "ar" ? "حجب جهة الاتصال" : "Block this contact",
        })
        .first();

      if (role === "agent") {
        assert.equal(await block.isDisabled(), true);
        assert.equal(
          calls.filter((call) => call.path.endsWith("identity-block")).length,
          0,
        );
      } else {
        await block.click();
        const dialog = page.getByRole("dialog");

        assert.equal(await dialog.locator('input[type="tel"]').count(), 0);
        await dialog.locator("footer button").last().click();
        await dialog.waitFor({ state: "detached" });
        await page.reload();
        const unblock = page.getByRole("button", {
          name: locale === "ar" ? "إزالة الحظر المحلي" : "Remove local block",
          exact: true,
        });

        await unblock.waitFor();
        assert.equal(
          await page.locator("textarea").count(),
          0,
          "blocked state survives poll/reload",
        );
        await unblock.click();
        await unblock.waitFor({ state: "detached" });
        assert.deepEqual(
          calls
            .filter((call) => call.path.endsWith("/identity-block"))
            .map((call) => call.body),
          [{ blocked: true }, { blocked: false }],
        );
        assert.ok(
          !calls.some(
            (call) =>
              call.path.includes("blocked-whatsapp-numbers") &&
              call.method === "POST",
          ),
        );
      }

      await page.goto(`${base}/leads`);
      await page
        .getByText(
          locale === "ar" ? "رقم الهاتف غير متاح" : "Phone number unavailable",
          { exact: true },
        )
        .filter({ visible: true })
        .first()
        .waitFor();
      assert.equal(await page.locator("[class*='fi-lb']").count(), 0);
      assert.deepEqual(errors, []);
      console.log(`PASS user-ID chat: ${locale}, ${width}px, ${role}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
