require("dotenv").config();

const { circle_station } = require("./data/stationData");
const { recordFields_myJurisdiction_header } = require("./data/fieldNames");
const {
  groupCircleStations,
  getCircleNames,
} = require("./utils/groupCircleStation");
const { mergeArrayData } = require("./utils/mergeArrayData");
const { exportStationFieldsToExcel } = require("./utils/excelCreate");
const puppeteer = require("puppeteer");

const yakshCriminalRecordMyJurisdictionHeaders = async (page) => {
  //============ GO TO PAGE =============================

  await page.goto(
    "https://yaksh.ai/panel/all-criminal-record/?by=address&address_subdistrict=my",
    {
      waitUntil: "domcontentloaded",
    },
  );

  // wait tabs
  await page.waitForSelector(".ant-tabs-nav-list", {
    visible: true,
    timeout: 60000,
  });

  // click incorrect address tab
  await page.click('[data-node-key="approved"]');

  // wait page load
  await new Promise((resolve) => setTimeout(resolve, 3000));

  try {
    // ================= GROUP DATA =================

    const grouped = await groupCircleStations(circle_station);

    // ================= FINAL RESULT ARRAY =================

    const finalResults = [];

    // =====================================================
    // ================= FIELD LOOP =========================
    // =====================================================

    for (let field of recordFields_myJurisdiction_header) {
      field = field.trim();

      let tabid = "";

      if (field == "myJurisdiction DCRB Approved") {
        tabid = "#rc-tabs-0-tab-approved";
      } else if (field == "myJurisdiction Beat Verification Pending") {
        tabid = "#rc-tabs-0-tab-verification_pending";
      } else if (field == "myJurisdiction Beat Verification Completed") {
        tabid = "#rc-tabs-0-tab-verified";
      } else if (
        field == "myJurisdiction Incorrect Address Reported by Beat Officer"
      ) {
        tabid = "#rc-tabs-0-tab-incorrect_address";
      }

      // ================= INVALID TAB =================

      if (!tabid) {
        console.log("❌ INVALID TAB =>", field);

        continue;
      }

      // ================= CLICK TAB =================

      await page.click(tabid);

      await new Promise((resolve) => setTimeout(resolve, 4000));

      console.log("\n==============================");
      console.log("TAB =>", field);
      console.log("==============================\n");

      // =====================================================
      // ================= CIRCLE LOOP ========================
      // =====================================================

      for (const circle_name of Object.keys(grouped)) {
        const stations = grouped[circle_name];

        try {
          // ================= CLEAR OLD CIRCLE =================

          await page.click("#rc_select_0", {
            clickCount: 3,
          });

          await page.keyboard.press("Backspace");

          await new Promise((resolve) => setTimeout(resolve, 1000));

          // ================= SELECT CIRCLE =================

          await page.type("#rc_select_0", circle_name.replace("CIRCLE ", ""));

          await page.waitForFunction(() => {
            return (
              document.querySelectorAll(".ant-select-item-option").length > 0
            );
          });

          const circleSelected = await page.evaluate((circleName) => {
            const normalize = (str) =>
              str.toLowerCase().replace(/\s+/g, " ").trim();

            const target = normalize(circleName);

            const options = document.querySelectorAll(
              ".ant-select-item-option",
            );

            for (const option of options) {
              const text = normalize(option.innerText);

              if (text.includes(target)) {
                option.click();

                return true;
              }
            }

            return false;
          }, circle_name);

          if (!circleSelected) {
            console.log("❌ CIRCLE NOT FOUND =>", circle_name);

            continue;
          }

          await new Promise((resolve) => setTimeout(resolve, 2000));

          // =====================================================
          // ================= STATION LOOP =======================
          // =====================================================

          for (const stationName of stations) {
            try {
              // ================= CLEAR OLD STATION =================

              await page.evaluate(() => {
                const allSelects = document.querySelectorAll(".ant-select");

                const select = allSelects[1];

                if (!select) return;

                const clearBtn = select.querySelector(".ant-select-clear");

                if (clearBtn) {
                  clearBtn.click();
                }
              });

              await new Promise((resolve) => setTimeout(resolve, 1000));

              // ================= SELECT STATION =================

              await page.click("#rc_select_1", {
                clickCount: 3,
              });

              await page.keyboard.press("Backspace");

              await page.type("#rc_select_1", stationName);

              await page.waitForFunction(() => {
                return (
                  document.querySelectorAll(".ant-select-item-option").length >
                  0
                );
              });

              const stationSelected = await page.evaluate((station) => {
                const normalize = (str) =>
                  str.toLowerCase().replace(/\s+/g, " ").trim();

                const target = normalize(station);

                const items = document.querySelectorAll(
                  ".ant-select-item-option",
                );

                for (const el of items) {
                  const text = normalize(el.innerText);

                  if (text === target) {
                    el.click();

                    return true;
                  }
                }

                return false;
              }, stationName);

              if (!stationSelected) {
                console.log("❌ STATION NOT FOUND =>", stationName);

                continue;
              }

              await new Promise((resolve) => setTimeout(resolve, 2000));

              // =====================================================
              // ================= APPLY FILTER =======================
              // =====================================================

              const oldValue = await page
                .$eval(".table-pagination p span", (el) => el.innerText.trim())
                .catch(() => "0");

              await page.evaluate(() => {
                const btn = [...document.querySelectorAll("button")].find(
                  (b) => b.innerText.trim() === "Apply",
                );

                if (btn) btn.click();
              });

              await new Promise((resolve) => setTimeout(resolve, 2000));
              // =====================================================
              // ================= WAIT + RETRY RESULT ================
              // =====================================================

              let totalResult = "0";

              let retryCount = 0;

              const maxRetry = 5;

              while (retryCount < maxRetry) {
                try {
                  // ================= WAIT RESULT =================

                  await page.waitForFunction(
                    () => {
                      const el = document.querySelector(
                        ".table-pagination p span",
                      );

                      if (!el) return false;

                      const text = el.innerText.trim();

                      return /^[0-9,]+$/.test(text);
                    },
                    {
                      timeout: 30000,
                      polling: 500,
                    },
                  );

                  // ================= EXTRA WAIT =================

                  await new Promise((resolve) => setTimeout(resolve, 2000));

                  // ================= GET RESULT =================

                  totalResult = await page.$eval(
                    ".table-pagination p span",
                    (el) => el.innerText.trim(),
                  );

                  // ================= VALIDATE =================

                  if (/^[0-9,]+$/.test(totalResult)) {
                    console.log(
                      `✅ RESULT FOUND => ${totalResult} | Retry => ${retryCount}`,
                    );

                    break;
                  }
                } catch (err) {
                  console.log(
                    `⚠️ RESULT NOT FOUND | Retry => ${retryCount + 1}`,
                  );
                }

                // ================= RETRY APPLY =================

                retryCount++;

                await page.evaluate(() => {
                  const btn = [...document.querySelectorAll("button")].find(
                    (b) => b.innerText.trim() === "Apply",
                  );

                  if (btn) btn.click();
                });

                await new Promise((resolve) => setTimeout(resolve, 3000));
              }

              // ================= FINAL FALLBACK =================

              if (!/^[0-9,]+$/.test(totalResult)) {
                totalResult = "0";

                console.log("❌ FINAL RESULT FAILED => USING 0");
              }

              // =====================================================
              // ================= FIND EXISTING OBJECT ===============
              // =====================================================

              let stationResult = finalResults.find(
                (item) =>
                  item.circle_name === circle_name &&
                  item.station_name === stationName,
              );

              // ================= CREATE IF NOT EXISTS =================

              if (!stationResult) {
                stationResult = {
                  circle_name,
                  station_name: stationName,
                  fields: {},
                };

                finalResults.push(stationResult);
              }

              // ================= SAVE FIELD RESULT =================

              stationResult.fields[field] = totalResult;

              // ================= LOG RESULT =================

              console.log(
                "Circle =>",
                circle_name,
                "| Station =>",
                stationName,
                "| Field =>",
                field,
                "| Result =>",
                totalResult,
              );
            } catch (stationError) {
              console.log(
                "❌ STATION ERROR =>",
                stationName,
                stationError.message,
              );
            }
          }
        } catch (circleError) {
          console.log("❌ CIRCLE ERROR =>", circle_name, circleError.message);
        }
      }
    }

    // ================= FINAL RESULTS =================

    console.log("================ FINAL RESULTS ================");

    console.log(JSON.stringify(finalResults, null, 2));

    return finalResults;
  } catch (error) {
    console.log("ERROR =>", error);

    return [];
  }
};

// ======================================================
// ================= MAIN PUPPETEER =====================
// ======================================================

// login page
const yakshPuppeteertesting = async () => {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: false,

      protocolTimeout: 300000,

      executablePath:
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",

      userDataDir: "/Users/apple/puppeteer-sessions/chrome-data",

      args: [
        "--start-maximized",
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-blink-features=AutomationControlled",
        // ADD THESE
        "--disable-renderer-backgrounding",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-features=TranslateUI",
      ],

      defaultViewport: null,
    });

    const page = await browser.newPage();

    page.setDefaultTimeout(180000);
    page.setDefaultNavigationTimeout(180000);
    // optional default timeout

    await page.goto("https://yaksh.ai", {
      waitUntil: "domcontentloaded",
    });

    const jsondata = await yakshCriminalRecordMyJurisdictionHeaders(page);

    await exportStationFieldsToExcel(jsondata);

    console.log("✅ ALL TASK COMPLETED");
  } catch (error) {
    console.error("❌ ERROR =>", error);
  } finally {
    // if (browser) {
    //   console.log("🛑 Closing browser...");
    //   await browser.close();
    // }
  }
};

yakshPuppeteertesting();
