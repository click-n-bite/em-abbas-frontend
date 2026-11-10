/** Synthetic lead workflow checks; every API request is intercepted. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright",
);
const base = process.env.LEAD_PREVIEW_URL ?? "http://127.0.0.1:3107";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const locale of ["en", "ar"])
    for (const width of [1440, 1280, 1024, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        serviceWorkers: "block",
      });
      await context.addInitScript(
        ({ locale }) => {
          localStorage.setItem("ema.token", "preview-token");
          localStorage.setItem("ema.refresh-token", "preview-refresh");
          localStorage.setItem("ema.locale", locale);
          localStorage.setItem("ema.theme", locale === "ar" ? "dark" : "light");
          localStorage.setItem(
            "ema.agent",
            JSON.stringify({
              id: "42",
              name: "Preview agent",
              role: "agent",
              expiresAt: Date.now() + 3600000,
            }),
          );
        },
        { locale },
      );
      let lead = {
        id: 7,
        status: "open",
        source: "ai",
        conversationId: "preview-chat",
        phone: "+96171123456",
        customerName: "Preview customer",
        serviceId: 1,
        serviceKey: "dream",
        serviceName: "Dream interpretation",
        collectedFields: {},
        note: null,
        createdBy: null,
        closedBy: null,
        closeNote: null,
        closedAt: null,
        createdAt: "2026-11-07T10:00:00Z",
        updatedAt: "2026-11-07T10:00:00Z",
      };
      const changes = [];
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        const json = (data) => route.fulfill({ json: { data } });
        if (url.pathname === "/api/leads/services")
          return json([{ id: 1, key: "dream", name: lead.serviceName }]);
        if (url.pathname === "/api/leads/7") {
          if (route.request().method() !== "GET") {
            const body = route.request().postDataJSON();
            changes.push(body.status);
            lead = {
              ...lead,
              ...body,
              startedAt: body.status === "open" ? null : "2026-11-07T11:00:00Z",
              startedBy:
                body.status === "open"
                  ? null
                  : { id: 42, displayName: "Preview agent" },
            };
          }
          return json(lead);
        }
        if (url.pathname === "/api/leads") {
          const matches =
            !url.searchParams.get("status") ||
            url.searchParams.get("status") === lead.status;
          return json({
            items: matches ? [lead] : [],
            page: 0,
            size: 25,
            total: matches ? 1 : 0,
            totalPages: matches ? 1 : 0,
          });
        }
        if (
          url.pathname.startsWith("/api/") ||
          url.origin !== new URL(base).origin
        )
          return json([]);
        return route.continue();
      });
      const page = await context.newPage();
      const labels =
        locale === "en"
          ? [
              "Start progress",
              "In progress",
              "Return to Open",
              "Close",
              "Close lead",
              "Reopen",
            ]
          : [
              "بدء المعالجة",
              "قيد المعالجة",
              "إعادة إلى مفتوح",
              "إغلاق",
              "إغلاق الطلب",
              "إعادة فتح",
            ];
      await page.goto(`${base}/leads`);
      const startAction = page.getByRole("button", {
        name: labels[0],
        exact: true,
      });
      await startAction.waitFor();
      assert.equal(
        await page
          .locator("header")
          .evaluateAll((headers) =>
            headers.every((header) => header.scrollWidth <= header.clientWidth),
          ),
        true,
        "Toolbar must fit the viewport",
      );
      if (width >= 1024) {
        const bounds = await startAction.boundingBox();
        assert.ok(bounds.height <= 36, "Table start action stays on one line");
      }
      if (process.env.LEAD_SCREENSHOT_DIR) {
        await mkdir(process.env.LEAD_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({
          path: path.join(
            process.env.LEAD_SCREENSHOT_DIR,
            `leads-${locale}-${width}.png`,
          ),
          fullPage: true,
        });
      }
      await startAction.click();
      await page.getByRole("tab", { name: new RegExp(labels[1]) }).click();
      const returnAction = page.getByRole("button", {
        name: labels[2],
        exact: true,
      });
      const checkProgressActions = async () => {
        if (width < 1024) {
          await returnAction.waitFor();
          return;
        }
        await page
          .getByRole("button", {
            name: locale === "en" ? "Close lead" : "إغلاق العميل المحتمل",
            exact: true,
          })
          .waitFor();
        const moreLabel =
          locale === "en" ? "More actions" : "المزيد من الإجراءات";
        const chat = page.getByRole("button", {
          name: locale === "en" ? "Open chat" : "فتح المحادثة",
          exact: true,
        });
        assert.equal(await chat.isVisible(), false);
        await page
          .getByRole("button", { name: moreLabel, exact: true })
          .click();
        await returnAction.waitFor();
        await chat.waitFor();
        await page.keyboard.press("Escape");
        await chat.waitFor({ state: "hidden" });
      };
      await checkProgressActions();
      await page.waitForURL(/status=in_progress/);
      await page.reload();
      await checkProgressActions();
      assert.equal(
        new URL(page.url()).searchParams.get("status"),
        "in_progress",
      );
      await page.goto(`${base}/leads/7`);
      await page.getByText("Preview agent", { exact: true }).last().waitFor();
      await page.getByRole("button", { name: labels[2], exact: true }).click();
      await page.getByRole("button", { name: labels[0], exact: true }).click();
      await page
        .locator("section.card header")
        .getByRole("button", { name: labels[3], exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.locator("textarea").fill("Completed follow-up");
      // The dialog has a single submit button with the danger style in both locales.
      await dialog.locator("button.btn-danger").click();
      await page.getByRole("button", { name: labels[5], exact: true }).click();
      await page
        .getByRole("button", { name: labels[0], exact: true })
        .waitFor();
      assert.deepEqual(changes, [
        "in_progress",
        "open",
        "in_progress",
        "closed",
        "open",
      ]);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      console.log(
        `PASS ${locale} ${width}px: list, URL restore, details, start, return, close, reopen`,
      );
      await context.close();
    }
} finally {
  await browser.close();
}
