/** Synthetic browser checks. All API traffic is intercepted; no real data is exported. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);

const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright",
);

const base = process.env.LEAD_PREVIEW_URL ?? "http://127.0.0.1:3107";

const origin = new URL(base).origin;

const mime =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const bytes = Buffer.from("PK\u0003\u0004synthetic-workbook-response");

const browser = await chromium.launch({ channel: "chrome", headless: true });

const active =
  "status=closed&source=ai&service=2&from=2026-11-01&to=2026-11-03&mine=1&q=Fatima&page=3&size=10&sort=phone&dir=asc";

async function fixture(locale = "en", width = 1440, mode = "success") {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    serviceWorkers: "block",
    acceptDownloads: true,
  });

  const calls = [];

  const listCalls = [];

  let refreshes = 0;

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
          expiresAt: Date.now() + 3_600_000,
        }),
      );
    },
    { locale },
  );
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === "/api/leads/export") {
      calls.push({
        query: url.searchParams,
        headers: route.request().headers(),
      });

      if (mode === "refresh" && calls.length === 1)
        return route.fulfill({
          status: 401,
          json: { message: "Expired token" },
        });

      if (mode === "error")
        return route.fulfill({
          status: 422,
          json: { message: "Export is too large for one worksheet" },
        });

      if (mode === "invalid")
        return route.fulfill({ json: { message: "Unexpected JSON response" } });

      if (mode === "slow")
        await new Promise((resolve) => setTimeout(resolve, 1000));

      return route
        .fulfill({
          contentType: mime,
          body: bytes,
          headers:
            mode === "fallback"
              ? {}
              : {
                  "Access-Control-Expose-Headers": "Content-Disposition",
                  "Content-Disposition":
                    "attachment; filename*=UTF-8''leads-preview.xlsx",
                },
        })
        .catch(() => undefined);
    }

    if (url.pathname === "/api/auth/refresh") {
      refreshes++;

      return route.fulfill({
        json: {
          data: {
            accessToken: "fresh-preview-token",
            refreshToken: "fresh-refresh",
          },
        },
      });
    }

    if (url.pathname === "/api/leads/services")
      return route.fulfill({
        json: { data: [{ id: 2, key: "dream", name: "Dream interpretation" }] },
      });

    if (url.pathname === "/api/leads") {
      listCalls.push(url.searchParams);

      return route.fulfill({
        json: {
          data: { items: [], page: 2, size: 10, total: 25, totalPages: 3 },
        },
      });
    }

    if (url.origin !== origin || url.pathname.startsWith("/api/")) {
      if (url.pathname.includes("/ws"))
        return route.fulfill({
          status: 503,
          body: "Realtime disabled in preview",
        });

      return route.fulfill({ json: { data: [], unreadCount: 0 } });
    }

    return route.continue();
  });
  const page = await context.newPage();

  await page.goto(`${base}/leads?${active}`);
  await page
    .getByRole("button", {
      name: locale === "ar" ? "تصدير Excel" : "Export Excel",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");

  await dialog.waitFor();

  return {
    context,
    page,
    dialog,
    calls,
    listCalls,
    refreshes: () => refreshes,
  };
}

async function download(f, locale = "en") {
  const promise = f.page.waitForEvent("download");

  await f.dialog
    .getByRole("button", {
      name: locale === "ar" ? "تنزيل Excel" : "Download Excel",
      exact: true,
    })
    .click();
  const result = await promise;

  const stream = await result.createReadStream();

  const chunks = [];

  for await (const chunk of stream) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), bytes);

  return result;
}

try {
  for (const [locale, width] of [
    ["en", 1440],
    ["ar", 390],
    ["en", 320],
  ]) {
    const f = await fixture(locale, width);

    try {
      await f.dialog.locator('input[value="filtered"]').waitFor();
      assert.equal(
        await f.dialog.locator('input[value="filtered"]').isChecked(),
        true,
      );
      const bounds = await f.dialog.boundingBox();

      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
      assert.equal(
        await f.page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        true,
      );

      if (locale === "ar")
        assert.equal(await f.page.locator("html").getAttribute("dir"), "rtl");

      if (process.env.LEAD_PREVIEW_OUTPUT) {
        await mkdir(process.env.LEAD_PREVIEW_OUTPUT, { recursive: true });
        await f.page.screenshot({
          path: path.join(
            process.env.LEAD_PREVIEW_OUTPUT,
            `export-${locale}-${width}.png`,
          ),
        });
      }

      const result = await download(f, locale);

      assert.equal(result.suggestedFilename(), "leads-preview.xlsx");
      assert.equal(f.calls.length, 1);
      const query = f.calls[0].query;

      assert.equal(query.get("scope"), "filtered");
      assert.equal(query.get("language"), locale);
      for (const key of [
        "status",
        "source",
        "serviceId",
        "from",
        "to",
        "mine",
        "search",
        "sort",
        "direction",
      ]) {
        assert.equal(
          query.get(key),
          f.listCalls.find((item) => item.get("size") === "10").get(key),
          `Filter mismatch: ${key}`,
        );
      }
      assert.equal(query.has("page"), false);
      assert.equal(query.has("size"), false);
      assert.equal(f.calls[0].headers.authorization, "Bearer preview-token");
      assert.notEqual(f.calls[0].headers.accept, "application/json");
      await f.dialog.waitFor({ state: "detached" });
    } finally {
      await f.context.close();
    }
  }

  const all = await fixture();

  try {
    await all.dialog.locator('input[value="all"]').check();
    await download(all);
    assert.deepEqual([...all.calls[0].query.keys()].sort(), [
      "direction",
      "language",
      "scope",
      "sort",
    ]);
    assert.equal(all.calls[0].query.get("scope"), "all");
  } finally {
    await all.context.close();
  }

  const refresh = await fixture("en", 1440, "refresh");

  try {
    await download(refresh);
    assert.equal(refresh.refreshes(), 1);
    assert.equal(refresh.calls.length, 2);
    assert.equal(
      refresh.calls[1].headers.authorization,
      "Bearer fresh-preview-token",
    );
  } finally {
    await refresh.context.close();
  }

  const fallback = await fixture("en", 1440, "fallback");

  try {
    assert.match(
      (await download(fallback)).suggestedFilename(),
      /^leads-\d{4}-\d{2}-\d{2}\.xlsx$/,
    );
  } finally {
    await fallback.context.close();
  }

  for (const mode of ["error", "invalid"]) {
    const f = await fixture("en", 1440, mode);

    try {
      let downloads = 0;

      f.page.on("download", () => downloads++);
      await f.dialog
        .getByRole("button", { name: "Download Excel", exact: true })
        .click();
      await f.dialog.getByRole("alert").waitFor();
      assert.match(
        await f.dialog.getByRole("alert").innerText(),
        mode === "error" ? /too large/ : /Unable to export/,
      );
      assert.equal(downloads, 0);
      assert.equal(
        await f.dialog
          .getByRole("button", { name: "Download Excel", exact: true })
          .isEnabled(),
        true,
      );
    } finally {
      await f.context.close();
    }
  }

  const slow = await fixture("en", 1440, "slow");

  try {
    let downloads = 0;

    slow.page.on("download", () => downloads++);
    await slow.dialog
      .getByRole("button", { name: "Download Excel", exact: true })
      .click();
    const preparing = slow.dialog.getByRole("button", {
      name: "Preparing Excel…",
      exact: true,
    });

    await preparing.waitFor();
    assert.equal(await preparing.isDisabled(), true);
    assert.equal(
      await slow.dialog.locator('input[value="all"]').isDisabled(),
      true,
    );
    await slow.dialog
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await slow.dialog.waitFor({ state: "detached" });
    await slow.page.waitForTimeout(1200);
    assert.equal(downloads, 0);
    assert.equal(slow.calls.length, 1);
  } finally {
    await slow.context.close();
  }

  console.log(
    "Lead export browser checks passed (9 scenarios, English/Arabic, mobile/desktop, filters, auth refresh, errors, cancellation).",
  );
} finally {
  await browser.close();
}
