/** Synthetic permission/CRUD checks; all API traffic is intercepted. */
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
  for (const [role, locale, width] of [
    ["agent", "en", 1440],
    ["agent", "ar", 390],
    ["admin", "en", 1440],
    ["superadmin", "en", 1440],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      serviceWorkers: "block",
    });

    const calls = [];

    const row = {
      id: "7",
      phone: "96171123456",
      reason: "Synthetic block",
      createdBy: 42,
      localStatus: "blocked",
      whatsappStatus: "blocked",
      whatsappError: null,
      waId: null,
      createdAt: "2026-11-03T10:00:00Z",
      updatedAt: "2026-11-03T10:00:00Z",
    };

    let rows = [row];

    const conversation = {
      id: "preview-chat",
      phone: "96171123456",
      customerName: "Sample customer",
      mode: "bot",
      assigneeId: null,
      preview: "Test message",
      lastMessageAt: row.updatedAt,
      unreadCount: 0,
      blocked: false,
      hidden: false,
      metaCustomerName: "Sample",
      nameOverridden: false,
    };

    await context.addInitScript(
      ({ role, locale }) => {
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
      { role, locale },
    );
    await context.route("**/*", async (route) => {
      const request = route.request();

      const url = new URL(request.url());

      if (url.pathname.startsWith("/api/admin/blocked-whatsapp-numbers")) {
        calls.push({
          method: request.method(),
          url,
          body: request.postDataJSON(),
          auth: request.headers().authorization,
        });

        if (request.method() === "POST" && url.pathname.endsWith("/unblock")) {
          rows = [
            { ...row, localStatus: "unblocked", whatsappStatus: "unblocked" },
          ];

          return route.fulfill({ json: { data: rows[0] } });
        }

        if (request.method() === "POST") {
          rows = [{ ...row, ...request.postDataJSON(), phone: "96171123456" }];

          return route.fulfill({ status: 201, json: { data: rows[0] } });
        }

        return route.fulfill({
          json: {
            data: rows.filter(
              (entry) =>
                url.searchParams.get("status") === "all" ||
                entry.localStatus === url.searchParams.get("status"),
            ),
          },
        });
      }

      if (url.origin !== origin && url.pathname === "/conversations")
        return route.fulfill({ json: [conversation] });

      if (
        url.origin !== origin &&
        url.pathname === "/conversations/preview-chat"
      )
        return route.fulfill({ json: conversation });

      if (
        url.origin !== origin &&
        url.pathname.startsWith("/conversations/preview-chat/")
      )
        return route.fulfill({ json: [] });

      if (url.origin !== origin || url.pathname.startsWith("/api/")) {
        if (url.pathname.includes("/ws"))
          return route.fulfill({ status: 503, body: "Preview" });

        return route.fulfill({ json: { data: [], unreadCount: 0 } });
      }

      return route.continue();
    });

    try {
      const page = await context.newPage();

      await page.goto(`${base}/blocked-numbers`);
      const blockLabel = locale === "ar" ? "حجب الرقم" : "Block number";

      // Use the toolbar action rather than relying on translated wording below.
      const toolbarAdd = page.getByRole("button", {
        name: blockLabel,
        exact: true,
      });

      await toolbarAdd.waitFor();
      await page.getByText("+96171123456", { exact: true }).waitFor();
      assert.ok(calls.some((call) => call.method === "GET"));
      assert.ok(calls.every((call) => call.auth === "Bearer preview-token"));

      if (role === "agent") {
        assert.equal(
          await page.locator('aside a[href="/blocked-numbers"]').count(),
          1,
        );
        assert.equal(
          await page
            .locator('aside a[href="/users"], aside a[href="/blacklist"]')
            .count(),
          0,
        );
      }

      await toolbarAdd.click();
      const dialog = page.getByRole("dialog");

      await dialog.waitFor();
      await dialog.locator('input[type="tel"]').fill("71123456");
      await dialog
        .locator("#block-number-reason")
        .fill("Synthetic agent reason");
      await dialog
        .locator("footer")
        .getByRole("button", { name: blockLabel, exact: true })
        .click();
      await dialog.waitFor({ state: "detached" });
      const sent = calls.find(
        (call) =>
          call.method === "POST" && !call.url.pathname.endsWith("/unblock"),
      );

      assert.equal(sent.body.phone, "+96171123456");
      assert.equal(sent.body.reason, "Synthetic agent reason");
      const unblock = locale === "ar" ? "إلغاء الحجب" : "Unblock";

      await page.getByRole("button", { name: unblock, exact: true }).click();
      await page
        .getByRole("dialog")
        .locator("footer")
        .getByRole("button", { name: unblock, exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "detached" });
      assert.ok(
        calls.some(
          (call) =>
            call.url.pathname.endsWith("/7/unblock") && call.method === "POST",
        ),
      );

      if (role === "agent" && locale === "en") {
        await page.goto(`${base}/blacklist`);
        await page
          .getByText("Only super admins and admins can change this list.", {
            exact: true,
          })
          .waitFor();
        await page.goto(`${base}/users`);
        await page
          .getByText("Only super admins and admins can manage users.", {
            exact: true,
          })
          .waitFor();
        await page.goto(`${base}/conversations?id=preview-chat`);
        await page
          .getByRole("button", { name: "More actions", exact: true })
          .click();
        await page
          .getByRole("menuitem", { name: "Block this contact", exact: true })
          .waitFor();
        assert.equal(await page.getByRole("menuitem").count(), 1);
      }
    } finally {
      await context.close();
    }
  }
  console.log(
    "Agent blocking browser checks passed: list/block/unblock, agent/admin/superadmin, Arabic mobile, restricted admin pages and chat actions.",
  );
} finally {
  await browser.close();
}
