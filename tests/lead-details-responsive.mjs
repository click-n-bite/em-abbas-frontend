/**
 * Browser regression checks using synthetic data and intercepted API requests.
 * Start Next locally, then run: node tests/lead-details-responsive.mjs
 * Requires Playwright and Chrome. Set PLAYWRIGHT_MODULE_PATH if Playwright is
 * supplied externally; LEAD_PREVIEW_URL and LEAD_PREVIEW_OUTPUT are optional.
 * No requests are sent to a real API, and no login credentials are used.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright",
);
const base = process.env.LEAD_PREVIEW_URL ?? "http://127.0.0.1:3107";
const output = process.env.LEAD_PREVIEW_OUTPUT;
const origin = new URL(base).origin;
const svg = (portrait = false) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${portrait ? 320 : 640}" height="${portrait ? 480 : 360}"><rect width="100%" height="100%" fill="#e9e5da"/><rect x="22" y="22" width="${portrait ? 276 : 596}" height="${portrait ? 436 : 316}" rx="8" fill="#fffdf7" stroke="#c9c4b8"/><text x="44" y="75" font-family="sans-serif" font-size="22" fill="#334155">Sample attachment</text><path d="M44 120h210m-210 35h180m-180 35h205m-205 35h160" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/></svg>`;

function fixture(id) {
  const common = {
    full_name: "Fatima Al Hassan",
    mother_name: "رانيا",
    age: "30",
    country: "لبنان",
    nationality: "لبنانية",
    marital_status: "متزوج",
    contacted_om_abbas: "نعم",
    prior_contact_when: "منذ شهرين",
    prior_contact_service: "فتح قرآن",
    prior_contact_photos: ["/media/previous-1", "/media/previous-2"],
  };
  const fields =
    id === 42
      ? { ...common, palm_image: "/media/current-palm" }
      : id === 43
        ? {
            ...common,
            problem_description:
              "خلافات مستمرة بين الزوجين، وأرغب في توضيح التفاصيل للفريق.",
            separation_timing: "منذ شهرين",
            has_contact: "نعم، أحيانًا",
            third_party_or_betrayal: "لا",
            prior_treatment_detail: "لم يسبق العلاج",
          }
        : id === 44
          ? {
              ...common,
              custom_question: "Long answer ".repeat(40),
              reference_answer: "x".repeat(300),
              confirmed: false,
              count: 0,
              new_service_photo: "/media/missing",
              another_optional_answer: "__skipped__",
              __private: "hidden",
            }
          : id === 46
            ? {
                full_name: "Sample Legacy Customer",
                mother_name: "مريم",
                age: "30",
                country: "لبنان",
                nationality: "لبناني",
                follows_on_social: "لا",
                contacted_om_abbas: "لا",
                service_details: "__skipped__",
              }
            : {};

  return {
    id,
    status: "open",
    source: "ai",
    conversationId: "preview-chat",
    phone: "0000000000",
    customerName: "Fatima Al Hassan",
    serviceId: id,
    serviceKey:
      id === 42
        ? "palm_reading"
        : id === 46
          ? "urgent_consult"
          : "marital_problem",
    serviceName:
      id === 42
        ? "قراءة الكف"
        : id === 46
          ? "استشارة خاصة مستعجلة"
          : "معالجة مشاكل زوجية",
    collectedFields: fields,
    note: null,
    createdBy: null,
    closedBy: null,
    closeNote: null,
    closedAt: null,
    createdAt: "2026-10-27T17:11:00Z",
    updatedAt: "2026-10-27T17:11:00Z",
  };
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
let checks = 0;

async function contextFor(locale, theme, role = "superadmin") {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const leads = new Map();

  await context.addInitScript(
    ({ locale, theme, role }) => {
      localStorage.setItem("ema.token", "local-preview-token");
      localStorage.setItem(
        "ema.agent",
        JSON.stringify({
          id: "preview",
          name: "Preview admin",
          role,
          expiresAt: Date.now() + 3_600_000,
        }),
      );
      localStorage.setItem("ema.locale", locale);
      localStorage.setItem("ema.theme", theme);
    },
    { locale, theme, role },
  );

  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const leadMatch = /\/api\/leads\/(\d+)$/.exec(url.pathname);

    if (leadMatch) {
      const id = Number(leadMatch[1]);
      const lead = leads.get(id) ?? fixture(id);

      if (route.request().method() === "PATCH")
        Object.assign(lead, route.request().postDataJSON());
      leads.set(id, lead);

      return route.fulfill({ json: { data: lead } });
    }
    if (url.pathname.includes("/media/")) {
      return route.fulfill(
        url.pathname.endsWith("/missing")
          ? { status: 404, body: "Missing test image" }
          : {
              contentType: "image/svg+xml",
              body: svg(url.pathname.endsWith("-2")),
            },
      );
    }
    if (url.pathname.startsWith("/api-mock/") || url.origin !== origin) {
      if (url.pathname.includes("/ws"))
        return route.fulfill({
          status: 503,
          body: "Realtime disabled in preview",
        });

      return route.fulfill({ json: { data: [], unreadCount: 0 } });
    }

    return route.continue();
  });

  return context;
}

async function assertNoOverflow(page) {
  const dimensions = await page.evaluate(() => {
    const main = document.querySelector("main");

    return {
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      main: main.clientWidth,
      content: main.scrollWidth,
    };
  });
  assert.ok(
    dimensions.document <= dimensions.viewport + 1,
    JSON.stringify(dimensions),
  );
  assert.ok(
    dimensions.content <= dimensions.main + 1,
    JSON.stringify(dimensions),
  );
}

async function assertValueAlignment(page, locale) {
  const rows = await page
    .locator("section[aria-labelledby] dl > div")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const label = element.querySelector("dt").getBoundingClientRect();
        const value = element.querySelector("dd").getBoundingClientRect();
        const text = element.querySelector("dd > bdi").getBoundingClientRect();

        return {
          compact:
            element.closest("section").getAttribute("aria-labelledby") !==
            "lead-service-details",
          labelWidth: label.width,
          left: Math.abs(value.left - text.left),
          right: Math.abs(value.right - text.right),
        };
      }),
    );

  for (const row of rows) {
    if (row.compact) {
      assert.ok(
        row.labelWidth <= 129,
        `Label column is too wide: ${JSON.stringify(row)}`,
      );
    }
    assert.ok(
      (locale === "ar" ? row.right : row.left) <= 2,
      `Value alignment changed with text language: ${JSON.stringify(row)}`,
    );
  }
}

async function assertContentGutters(page) {
  const edges = await page.locator("main").evaluate((main) => {
    const style = getComputedStyle(main);
    const bounds = main.getBoundingClientRect();
    const card = main
      .querySelector(":scope > div > section.card")
      .getBoundingClientRect();
    const paddingLeft = parseFloat(style.paddingLeft);
    const paddingRight = parseFloat(style.paddingRight);
    const contentLeft = bounds.left + main.clientLeft;

    return {
      left: Math.abs(card.left - (contentLeft + paddingLeft)),
      right: Math.abs(
        card.right - (contentLeft + main.clientWidth - paddingRight),
      ),
      paddingLeft,
      paddingRight,
    };
  });

  assert.ok(
    edges.left <= 1 && edges.right <= 1,
    `Card does not fill the content area: ${JSON.stringify(edges)}`,
  );
  assert.ok(
    edges.paddingLeft <= 32 && edges.paddingRight <= 32,
    `Page gutters are too large: ${JSON.stringify(edges)}`,
  );
}

try {
  if (output) await mkdir(output, { recursive: true });

  for (const [locale, theme] of [
    ["en", "light"],
    ["ar", "light"],
    ["ar", "dark"],
  ]) {
    const context = await contextFor(locale, theme);
    const page = await context.newPage();
    const errors = [];

    page.on("pageerror", (error) => errors.push(error.message));

    for (const width of [320, 390, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1200 });

      for (const id of [42, 43, 44, 45, 46]) {
        await page.goto(`${base}/leads/${id}`);
        await page
          .getByText("Fatima Al Hassan", { exact: true })
          .first()
          .waitFor();
        await page.waitForFunction(
          ({ locale, theme }) =>
            document.documentElement.lang === locale &&
            document.documentElement.dataset.theme === theme,
          { locale, theme },
        );

        if (id !== 45) {
          await page.locator("#lead-personal-information").waitFor();
          assert.equal(
            await page
              .locator("#lead-personal-information + dl figure")
              .count(),
            0,
          );
          assert.equal(
            await page
              .locator(
                "section[aria-labelledby='lead-previous-contact'] figure",
              )
              .count(),
            id === 46 ? 0 : 2,
          );

          await assertValueAlignment(page, locale);

          if (id === 42) {
            const trigger = page
              .locator(
                "section[aria-labelledby='lead-service-details'] figure button",
              )
              .first();

            await trigger.waitFor();
            assert.equal(
              await page
                .locator(
                  "section[aria-labelledby='lead-service-details'] figure",
                )
                .count(),
              1,
            );
            await trigger.click();
            await page.locator("dialog[open]").waitFor();
            await page.keyboard.press("Escape");
            assert.equal(await page.locator("dialog[open]").count(), 0);
            assert.ok(
              await trigger.evaluate(
                (element) => element === document.activeElement,
              ),
            );
            assert.equal(
              await trigger
                .locator("img")
                .evaluate((element) => getComputedStyle(element).objectFit),
              "contain",
            );
          } else if (id === 43) {
            assert.equal(
              await page
                .locator(
                  "section[aria-labelledby='lead-service-details'] figure",
                )
                .count(),
              0,
            );
            await page.getByText("نعم، أحيانًا", { exact: true }).waitFor();
          } else if (id === 44) {
            await page
              .getByText(
                locale === "ar" ? "الصورة غير متاحة" : "Image unavailable",
                { exact: true },
              )
              .waitFor();
            assert.equal(
              await page.getByText("hidden", { exact: true }).count(),
              0,
            );
          } else {
            await page
              .getByText(locale === "ar" ? "تم التخطي" : "Skipped", {
                exact: true,
              })
              .waitFor();
            assert.equal(
              await page
                .locator(
                  "section[aria-labelledby='lead-service-details'] figure",
                )
                .count(),
              0,
            );
          }
        } else {
          assert.equal(
            await page
              .locator(
                "#lead-personal-information, #lead-service-details, #lead-previous-contact",
              )
              .count(),
            0,
          );
        }

        await assertNoOverflow(page);
        await assertContentGutters(page);
        if (width >= 1440 && id === 44) {
          const value = page
            .locator("section[aria-labelledby='lead-service-details'] dd")
            .first();
          const bounds = await value.boundingBox();

          assert.ok(
            bounds.width <= 650,
            `Long answer has an excessive reading width: ${bounds.width}`,
          );
        }
        assert.deepEqual(errors, []);
        checks += 1;

        if (output && width === 1440 && locale === "en" && id === 43)
          await page.screenshot({
            path: path.join(output, "lead-desktop.png"),
          });
        if (output && width === 1920 && locale === "en" && id === 46)
          await page.screenshot({
            path: path.join(output, "lead-legacy-desktop.png"),
          });
        if (
          output &&
          width === 1440 &&
          locale === "ar" &&
          theme === "dark" &&
          id === 43
        )
          await page.screenshot({
            path: path.join(output, "lead-desktop-ar-dark.png"),
          });
        if (
          output &&
          width === 390 &&
          locale === "ar" &&
          theme === "light" &&
          id === 42
        )
          await page.screenshot({
            path: path.join(output, "lead-mobile-ar.png"),
          });
      }
    }

    await context.close();
    console.log(
      `PASS: ${locale}/${theme}, 5 widths × 5 lead types, consistent value alignment`,
    );
  }

  const adminContext = await contextFor("en", "light");
  const adminPage = await adminContext.newPage();

  await adminPage.goto(`${base}/leads/42`);
  await adminPage
    .getByRole("button", { name: "Edit note", exact: true })
    .click();
  await adminPage
    .getByRole("textbox")
    .fill("Synthetic note saved during browser testing.");
  await adminPage
    .getByRole("button", { name: "Save note", exact: true })
    .click();
  await adminPage
    .getByText("Synthetic note saved during browser testing.", { exact: true })
    .waitFor();
  await adminPage.getByRole("button", { name: "Close", exact: true }).click();
  const closeDialog = adminPage.getByRole("dialog", {
    name: "Close this lead",
    exact: true,
  });

  await closeDialog.getByRole("textbox").fill("Synthetic closure reason.");
  await closeDialog
    .getByRole("button", { name: "Close lead", exact: true })
    .click();
  await adminPage
    .getByRole("button", { name: "Reopen", exact: true })
    .waitFor();
  await adminPage
    .getByText("Synthetic closure reason.", { exact: true })
    .waitFor();
  await adminPage.getByRole("button", { name: "Reopen", exact: true }).click();
  await adminPage.getByRole("button", { name: "Close", exact: true }).waitFor();
  await adminPage
    .getByRole("button", { name: "Open chat", exact: true })
    .click();
  await adminPage.waitForURL("**/conversations?id=preview-chat");
  await adminContext.close();
  console.log(
    "PASS: edit note, close lead, reopen lead and open chat (mock API only)",
  );

  const agentContext = await contextFor("en", "light", "agent");
  const page = await agentContext.newPage();

  await page.goto(`${base}/leads/42`);
  await page.locator("#lead-personal-information").waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Edit note", exact: true }).count(),
    0,
  );
  assert.equal(
    await page.getByRole("button", { name: "Close", exact: true }).count(),
    0,
  );
  await agentContext.close();
  console.log(
    `PASS: ${checks} responsive scenarios, image previews, image errors, empty data and agent permissions`,
  );
} finally {
  await browser.close();
}
