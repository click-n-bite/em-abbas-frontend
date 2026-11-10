/** Synthetic end-to-end checks: every API request is intercepted; no notifications are sent. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright",
);

const base = process.env.LEAD_PREVIEW_URL ?? "http://127.0.0.1:3107";

const origin = new URL(base).origin;

const browser = await chromium.launch({ channel: "chrome", headless: true });

const output = "node_modules/.cache/lead-resend-preview";

await mkdir(output, { recursive: true });

function batch(id = "batch-1", overrides = {}) {
  return {
    id,
    status: "draft",
    recipientPhone: "96171123456",
    recipientName: "Replacement agent",
    createdBy: 42,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
    startedAt: null,
    cancelledAt: null,
    total: 3,
    pending: 3,
    sending: 0,
    retrying: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    cancelled: 0,
    intervalSeconds: 5,
    nextSendAt: null,
    ...overrides,
  };
}

async function fixture({
  role = "admin",
  locale = "en",
  width = 1440,
  variant = "normal",
  historyCount = 0,
} = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 950 },
    serviceWorkers: "block",
  });

  const calls = [];

  const store = new Map();

  let numbers = [
    {
      id: 7,
      name: "Original agent",
      phoneNumber: "96171123458",
      notificationsEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  for (let index = 0; index < historyCount; index++)
    store.set(
      `history-${index}`,
      batch(`history-${index}`, {
        recipientName: `History ${index}`,
        total: 21,
        pending: 21,
      }),
    );
  let startFailures =
    variant === "start503" || variant === "startNetwork" ? 1 : 0;

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
          expiresAt: Date.now() + 3600000,
        }),
      );
    },
    { role, locale },
  );
  await context.route("**/*", async (route) => {
    const request = route.request();

    const url = new URL(request.url());

    const method = request.method();

    const ok = (data, status = 200) =>
      route.fulfill({ status, json: { success: true, data } });

    if (url.pathname.startsWith("/api/leads/resend-batches")) {
      calls.push({
        method,
        path: url.pathname,
        search: url.search,
        body: request.postDataJSON(),
        auth: request.headers().authorization,
      });

      if (variant === "unavailable")
        return route.fulfill({ status: 404, json: { message: "Not found" } });

      const parts = url.pathname.split("/").slice(4);

      if (method === "POST" && parts[0] === "preview") {
        const body = request.postDataJSON();

        const row = batch(`batch-${store.size + 1}`, {
          recipientName: body.recipientName || body.phoneNumber,
          recipientPhone: body.phoneNumber.replace(/\D/g, ""),
          ...(variant === "empty" ? { total: 0, pending: 0 } : {}),
          ...(variant === "expired"
            ? { expiresAt: new Date(Date.now() - 60000).toISOString() }
            : {}),
        });

        store.set(row.id, row);

        return ok(row, 201);
      }

      if (parts.length === 0) {
        const page = Number(url.searchParams.get("page"));

        const items = [...store.values()];

        return ok({
          items: items.slice(page * 10, page * 10 + 10),
          page,
          size: 10,
          total: items.length,
          totalPages: Math.ceil(items.length / 10),
        });
      }

      const row = store.get(parts[0]);

      if (!row)
        return route.fulfill({
          status: 404,
          json: { message: "Batch not found" },
        });

      if (method === "POST") {
        if (parts[1] === "start") {
          if (startFailures-- > 0) {
            if (variant === "startNetwork") return route.abort("failed");

            return route.fulfill({
              status: 503,
              json: { message: "WhatsApp middleware is not configured" },
            });
          }

          Object.assign(row, {
            status: "active",
            startedAt: new Date().toISOString(),
            sent: 1,
            failed: 1,
            pending: 1,
          });
        }

        if (parts[1] === "retry-failed")
          Object.assign(row, {
            status: "active",
            failed: 0,
            pending: row.total - row.sent,
          });

        if (parts[1] === "cancel")
          Object.assign(row, {
            status: "cancelled",
            cancelledAt: new Date().toISOString(),
            cancelled: row.total - row.sent,
            pending: 0,
            failed: 0,
          });

        return ok(row, 202);
      }

      if (parts[1] === "items") {
        let items = Array.from({ length: row.total }, (_, index) => ({
          id: index + 1,
          leadId: 100 + index,
          status:
            index < row.sent
              ? "sent"
              : index < row.sent + row.failed
                ? "dead"
                : row.status === "cancelled"
                  ? "cancelled"
                  : "pending",
          attempts: index < row.sent + row.failed && index >= row.sent ? 2 : 0,
          lastError:
            index < row.sent + row.failed && index >= row.sent
              ? `Synthetic failure ${"x".repeat(300)}`
              : null,
          nextAttemptAt: null,
          sentAt: null,
        }));

        if (url.searchParams.has("status"))
          items = items.filter(
            (item) => item.status === url.searchParams.get("status"),
          );

        const page = Number(url.searchParams.get("page"));

        return ok({
          items: items.slice(page * 20, page * 20 + 20),
          page,
          size: 20,
          total: items.length,
          totalPages: Math.ceil(items.length / 20),
        });
      }

      return ok(row);
    }

    if (url.pathname.startsWith("/api/admin/notify-whatsapp-numbers")) {
      calls.push({
        method,
        path: url.pathname,
        body: request.postDataJSON(),
        auth: request.headers().authorization,
      });

      if (method === "POST") {
        numbers.push({ ...numbers[0], id: 8, ...request.postDataJSON() });

        return ok(numbers.at(-1), 201);
      }

      if (method === "PATCH") {
        const index = numbers.findIndex(
          (n) => n.id === Number(url.pathname.split("/").at(-1)),
        );

        Object.assign(numbers[index], request.postDataJSON());

        return ok(numbers[index]);
      }

      if (method === "DELETE") {
        numbers = numbers.filter(
          (n) => n.id !== Number(url.pathname.split("/").at(-1)),
        );

        return route.fulfill({ status: 204 });
      }

      return ok(numbers);
    }

    if (url.origin !== origin || url.pathname.startsWith("/api/")) {
      if (url.pathname.includes("/ws"))
        return route.fulfill({ status: 503, body: "Preview" });

      return route.fulfill({ json: { data: [], unreadCount: 0 } });
    }

    return route.continue();
  });
  const page = await context.newPage();

  return { context, page, calls, store };
}

async function prepare(f) {
  await f.page.goto(`${base}/notify-phones?tab=resend`);
  await f.page.getByLabel("Destination phone number").fill("71123456");
  await f.page
    .getByLabel("Recipient name (optional)")
    .fill("Replacement agent");
  await f.page
    .getByRole("button", { name: "Preview leads", exact: true })
    .click();
  await f.page
    .getByRole("button", { name: "Send notifications", exact: true })
    .waitFor();
}

async function noOverflow(page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    "Horizontal page overflow",
  );
}

try {
  // Existing number management survives the page rename and tab extraction.
  {
    const f = await fixture();

    try {
      await f.page.goto(`${base}/notify-phones`);
      await f.page
        .getByRole("heading", { name: "Lead notifications", exact: true })
        .waitFor();
      await f.page.getByText("Original agent", { exact: false }).waitFor();
      await f.page
        .getByRole("button", { name: "Add number", exact: true })
        .click();
      const dialog = f.page.getByRole("dialog");

      await dialog.getByLabel("Name", { exact: true }).fill("Added agent");
      await dialog.getByLabel(/^Phone number/).fill("71123457");
      await dialog
        .getByRole("button", { name: "Save", exact: true })
        .last()
        .click();
      await dialog.waitFor({ state: "hidden" });
      const row = f.page.locator("li").filter({ hasText: "Added agent" });

      await row.getByRole("button", { name: "Notifications enabled" }).click();
      await row.getByRole("button", { name: "Edit", exact: true }).click();
      await f.page
        .getByRole("dialog")
        .getByLabel("Name", { exact: true })
        .fill("Edited agent");
      await f.page
        .getByRole("dialog")
        .getByRole("button", { name: "Save", exact: true })
        .last()
        .click();
      await f.page.getByRole("dialog").waitFor({ state: "hidden" });
      await f.page
        .locator("li")
        .filter({ hasText: "Edited agent" })
        .getByRole("button", { name: "Delete", exact: true })
        .click();
      await f.page
        .getByRole("dialog")
        .getByRole("button", { name: "Delete", exact: true })
        .click();
      await f.page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.ok(f.calls.some((c) => c.method === "DELETE"));
      assert.equal(
        f.calls.filter((c) => c.path.includes("resend-batches")).length,
        0,
      );
      console.log("PASS numbers CRUD and renamed navigation");
    } finally {
      await f.context.close();
    }
  }

  for (const variant of ["normal", "start503", "startNetwork"]) {
    const f = await fixture({ variant });

    try {
      await f.page.goto(`${base}/notify-phones?tab=resend`);
      await f.page
        .getByRole("button", { name: "Preview leads", exact: true })
        .click();
      assert.equal(f.calls.filter((c) => c.method === "POST").length, 0);
      await f.page.getByLabel("Destination phone number").fill("71123456");
      await f.page
        .getByLabel("Recipient name (optional)")
        .fill("Replacement agent");
      await f.page
        .getByRole("button", { name: "Preview leads", exact: true })
        .click();
      const send = f.page.getByRole("button", {
        name: "Send notifications",
        exact: true,
      });

      await send.waitFor();
      const preview = f.calls.find((c) => c.path.endsWith("/preview"));

      assert.deepEqual(preview.body, {
        phoneNumber: "+96171123456",
        recipientName: "Replacement agent",
        statuses: ["open", "in_progress"],
      });
      assert.equal(f.calls.filter((c) => c.path.endsWith("/start")).length, 0);
      await send.click();
      await f.page
        .getByRole("dialog")
        .getByRole("button", { name: "Close", exact: true })
        .last()
        .click();
      assert.equal(f.calls.filter((c) => c.path.endsWith("/start")).length, 0);
      await send.click();
      let dialog = f.page.getByRole("dialog");

      await dialog
        .getByRole("button", { name: "Confirm and send", exact: true })
        .click();

      if (variant !== "normal") {
        await dialog.getByRole("alert").waitFor();
        assert.equal(
          f.calls.filter((c) => c.path.endsWith("/preview")).length,
          1,
        );
        await dialog
          .getByRole("button", { name: "Confirm and send", exact: true })
          .click();
      }

      await dialog.waitFor({ state: "hidden" });
      assert.ok(
        f.calls
          .filter((c) => c.path.endsWith("/start"))
          .every((c) => c.path.includes("/batch-1/")),
      );
      // A later result appears through automatic polling, without another POST.
      Object.assign(f.store.get("batch-1"), {
        status: "completed_with_errors",
        sent: 2,
        pending: 0,
      });
      await f.page
        .getByText("Completed with errors", { exact: true })
        .first()
        .waitFor({ timeout: 12000 });
      await f.page.getByLabel("Status", { exact: true }).selectOption("dead");
      await f.page.getByText("Failed attempts: 2", { exact: true }).waitFor();
      await f.page.getByText("Details", { exact: true }).click();
      await noOverflow(f.page);
      await f.page.screenshot({
        path: `${output}/desktop-${variant}.png`,
        fullPage: true,
        animations: "disabled",
      });
      await f.page
        .getByRole("button", {
          name: "Retry failed notifications",
          exact: true,
        })
        .click();
      await f.page
        .getByRole("dialog")
        .getByRole("button", { name: "Retry failed", exact: true })
        .click();
      await f.page.getByRole("dialog").waitFor({ state: "hidden" });
      await f.page
        .getByRole("button", { name: "Cancel batch", exact: true })
        .click();
      await f.page
        .getByRole("dialog")
        .getByRole("button", { name: "Cancel batch", exact: true })
        .click();
      await f.page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.equal(
        f.calls.filter((c) => c.path.endsWith("/retry-failed")).length,
        1,
      );
      assert.equal(f.calls.filter((c) => c.path.endsWith("/cancel")).length, 1);
      assert.equal(f.calls.filter((c) => c.path.includes("/admin/")).length, 0);
      assert.ok(f.calls.every((c) => c.auth === "Bearer preview-token"));
      const starts = f.calls.filter((c) => c.path.endsWith("/start")).length;

      await f.page.reload();
      await f.page
        .getByRole("region", { name: "Batch details", exact: true })
        .getByText("Cancelled", { exact: true })
        .first()
        .waitFor();
      assert.equal(
        f.calls.filter((c) => c.path.endsWith("/start")).length,
        starts,
      );
      console.log(
        `PASS preview/confirm/poll/filter/retry/cancel/reload: ${variant}`,
      );
    } finally {
      await f.context.close();
    }
  }

  for (const variant of ["empty", "expired"]) {
    const f = await fixture({ variant });

    try {
      await prepare(f);
      assert.ok(
        await f.page
          .getByRole("button", { name: "Send notifications", exact: true })
          .isDisabled(),
      );
      assert.equal(f.calls.filter((c) => c.path.endsWith("/start")).length, 0);
      console.log(`PASS ${variant} preview cannot send`);
    } finally {
      await f.context.close();
    }
  }

  {
    const f = await fixture({ historyCount: 11 });

    try {
      await f.page.goto(`${base}/notify-phones?tab=resend`);
      const history = f.page.getByRole("region", {
        name: "Resend history",
        exact: true,
      });

      await history.getByRole("button", { name: "Next", exact: true }).click();
      await history.getByText("Page 2 of 2").waitFor();
      await history.getByRole("button", { name: /View batch/ }).click();
      const details = f.page.getByRole("region", {
        name: "Batch details",
        exact: true,
      });

      await details.getByRole("button", { name: "Next", exact: true }).click();
      await details
        .getByRole("link", { name: "View lead #120", exact: true })
        .waitFor();
      await details.getByLabel("Status", { exact: true }).selectOption("sent");
      await details.getByText("No notifications match this status.").waitFor();
      assert.ok(
        f.calls.some(
          (c) =>
            c.search?.includes("page=0") && c.search.includes("status=sent"),
        ),
      );
      console.log("PASS independent history/item pagination and filter reset");
    } finally {
      await f.context.close();
    }
  }

  {
    const f = await fixture({ role: "agent" });

    try {
      await f.page.goto(`${base}/notify-phones?tab=resend`);
      await f.page
        .getByText(
          "Only admins and super admins can manage lead notifications.",
          { exact: true },
        )
        .waitFor();
      assert.equal(await f.page.getByRole("tab").count(), 0);
      assert.equal(f.calls.length, 0);
      console.log("PASS agent has no page actions or protected API calls");
    } finally {
      await f.context.close();
    }
  }

  {
    const f = await fixture({ role: "superadmin", locale: "ar", width: 390 });

    try {
      await f.page.goto(`${base}/notify-phones?tab=resend`);
      await f.page.getByLabel("رقم الهاتف المستلم").fill("71123456");
      await f.page.getByLabel("اسم المستلم (اختياري)").fill("موظف بديل");
      await f.page
        .getByRole("button", { name: "معاينة الطلبات المفتوحة", exact: true })
        .click();
      await f.page
        .getByRole("button", { name: "إرسال الإشعارات", exact: true })
        .click();
      await f.page.getByRole("dialog").waitFor();
      assert.equal(await f.page.locator("html").getAttribute("dir"), "rtl");
      await noOverflow(f.page);
      await f.page.screenshot({
        path: `${output}/arabic-mobile-confirm.png`,
        fullPage: true,
        animations: "disabled",
      });
      await f.page
        .getByRole("dialog")
        .getByRole("button", { name: "تأكيد وإرسال", exact: true })
        .click();
      await f.page.getByRole("dialog").waitFor({ state: "hidden" });
      await noOverflow(f.page);
      console.log(
        "PASS superadmin Arabic mobile preview/confirmation and layout",
      );
    } finally {
      await f.context.close();
    }
  }

  {
    const f = await fixture({ variant: "unavailable" });

    try {
      await f.page.goto(`${base}/notify-phones?tab=resend`);
      await f.page.getByRole("alert").first().waitFor();
      assert.equal(f.calls.filter((c) => c.method === "POST").length, 0);
      console.log(
        "PASS unavailable backend is visible without accidental sends",
      );
    } finally {
      await f.context.close();
    }
  }
  // The client-reported case: cancelled send with no recipient name.
  {
    const f = await fixture();

    try {
      f.store.set(
        "cancelled-no-name",
        batch("cancelled-no-name", {
          status: "cancelled",
          recipientName: "96171123456",
          total: 21,
          pending: 0,
          cancelled: 21,
          startedAt: new Date().toISOString(),
        }),
      );
      await f.page.goto(
        `${base}/notify-phones?tab=resend&batch=cancelled-no-name`,
      );
      const details = f.page.getByRole("region", {
        name: "Batch details",
        exact: true,
      });

      await details
        .getByRole("heading", { name: "Sending cancelled", exact: true })
        .waitFor();
      assert.equal(
        await details.getByText("+96171123456", { exact: true }).count(),
        1,
      );
      assert.equal(
        await details.getByText("96171123456", { exact: true }).count(),
        0,
      );
      assert.equal(await details.locator("dd").count(), 4);
      assert.equal(
        await f.page.getByLabel("Destination phone number").count(),
        0,
      );
      await details
        .getByText(
          "0 notifications were sent before cancellation. 21 were not sent.",
          { exact: true },
        )
        .waitFor();
      await noOverflow(f.page);
      await f.page.screenshot({
        path: `${output}/cancelled-clear-overview.png`,
        animations: "disabled",
      });
      await f.page
        .getByRole("button", { name: "New resend", exact: true })
        .click();
      await f.page.getByLabel("Destination phone number").waitFor();
      assert.equal(f.calls.filter((c) => c.method === "POST").length, 0);
      console.log(
        "PASS clear cancelled state, no duplicate phone, four totals, and new resend",
      );
    } finally {
      await f.context.close();
    }
  }
} finally {
  await browser.close();
}
