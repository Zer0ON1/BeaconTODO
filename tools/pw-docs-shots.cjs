/**
 * Regenerates docs/screenshots from a running build with CDP enabled.
 *
 * Usage:
 *   1. temporarily add to src-tauri/tauri.conf.json (app.windows[0]):
 *        "additionalBrowserArgs": "--remote-debugging-port=9222"
 *   2. npm run tauri build && start the app
 *   3. npm i -D playwright-core && node tools/pw-docs-shots.cjs
 *   4. remove the debug args and rebuild
 *
 * Note: while the debug port is set, additional pin windows cannot be created
 * (WebView2 returns 0x8007139F), so capture the main window only.
 */
const { chromium } = require("playwright-core");
const path = require("path");

const OUT = path.join(__dirname, "..", "docs", "screenshots");

const clickText = (page, text) =>
  page.evaluate((value) => {
    const el = [...document.querySelectorAll("button")].find((b) =>
      (b.textContent || "").trim() === value
    );
    el?.click();
    return !!el;
  }, text);

(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const pages = browser.contexts().flatMap((c) => c.pages());
  const main = pages.find((p) => !p.url().includes("pin")) || pages[0];
  await main.waitForSelector("text=BeaconTODO", { timeout: 15000 });
  await main.waitForTimeout(1500);

  // Show every group so the demo todos are visible
  await main.evaluate(() => {
    const btn = [...document.querySelectorAll("aside button")].find((b) =>
      (b.textContent || "").trim().startsWith("全部")
    );
    btn?.click();
  });
  await main.waitForTimeout(900);

  // 1. list view
  await main.screenshot({ path: path.join(OUT, "01-main-list.png") });
  console.log("SHOT 01 list");

  // 2. expanded card
  await main.evaluate(() => document.querySelector("article")?.click());
  await main.waitForTimeout(900);
  await main.screenshot({ path: path.join(OUT, "08-card-expanded.png") });
  console.log("SHOT 08 expanded");
  await main.evaluate(() => document.querySelector("article h3")?.click());
  await main.waitForTimeout(600);

  // 3. calendar
  await clickText(main, "日历");
  await main.waitForTimeout(1000);
  await main.screenshot({ path: path.join(OUT, "02-calendar.png") });
  console.log("SHOT 02 calendar");

  // 4. kanban
  await clickText(main, "泳道");
  await main.waitForTimeout(1000);
  await main.screenshot({ path: path.join(OUT, "03-kanban.png") });
  console.log("SHOT 03 kanban");

  // 5. edit dialog
  await clickText(main, "列表");
  await main.waitForTimeout(700);
  await main.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "编辑");
    btn?.click();
  });
  await main.waitForTimeout(1000);
  await main.screenshot({ path: path.join(OUT, "05-edit-dialog.png") });
  console.log("SHOT 05 edit dialog");
  await main.keyboard.press("Escape");
  await main.waitForTimeout(600);

  // 6. opacity 70%
  await main.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      (b.getAttribute("title") || "").includes("设置")
    );
    btn?.click();
  });
  await main.waitForTimeout(700);
  await main.evaluate(() => {
    const slider = document.querySelector('input[type="range"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(slider, "70");
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await main.waitForTimeout(900);
  await main.screenshot({ path: path.join(OUT, "07-opacity.png") });
  console.log("SHOT 07 opacity");
  await main.keyboard.press("Escape");
  await main.waitForTimeout(400);
  // restore full opacity
  await main.evaluate(() => {
    const el = document.documentElement;
    el.style.setProperty("--window-alpha", "1");
  });
  await main.waitForTimeout(400);

  await browser.close().catch(() => {});
  console.log("DONE");
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
