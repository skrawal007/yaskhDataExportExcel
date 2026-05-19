require("dotenv").config();

const { circle_station } = require("./data/stationData");
const { recordFields_Beat } = require("./data/fieldNames");
const {
  groupCircleStations,
  getCircleNames,
} = require("./utils/groupCircleStation");
const { mergeArrayData } = require("./utils/mergeArrayData");
const { exportStationFieldsToExcel } = require("./utils/excelCreate");
const puppeteer = require("puppeteer");

const yakshBeatSuchnaApproved = async (page) => {
  await page.goto("https://yaksh.ai/panel/view-beat-suchana", {
    waitUntil: "domcontentloaded",
  });

  await page.waitForSelector("#rc_select_0");

  try {
    // =====================================================
    // GROUP DATA
    // =====================================================

    const grouped = await groupCircleStations(circle_station);

    // =====================================================
    // FINAL RESULT
    // =====================================================

    const finalResults = [];

    // =====================================================
    // CIRCLE LOOP
    // =====================================================

    for (const circle_name of Object.keys(grouped)) {
      const stations = grouped[circle_name];

      console.log("======================================");
      console.log("CIRCLE =>", circle_name);
      console.log("======================================");

      // =====================================================
      // SELECT CIRCLE
      // =====================================================

      await page.click("#rc_select_0");

      await page.type("#rc_select_0", circle_name.replace("CIRCLE ", ""));

      await page.waitForSelector(".ant-select-item-option");

      await page.evaluate((circleName) => {
        const options = document.querySelectorAll(".ant-select-item-option");

        for (const option of options) {
          if (option.innerText.includes(circleName)) {
            option.click();
            break;
          }
        }
      }, circle_name);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      for (const stationName of stations) {
        try {
          console.log("======================================");
          console.log("STATION =>", stationName);
          console.log("======================================");

          // =================================================
          // CLEAR OLD STATION
          // =================================================

          await page.evaluate(() => {
            const allSelects = document.querySelectorAll(".ant-select");

            const select = allSelects[1];

            if (!select) return;

            const clearBtn = select.querySelector(".ant-select-clear");

            if (clearBtn) clearBtn.click();
          });

          await new Promise((resolve) => setTimeout(resolve, 1000));

          // =================================================
          // SELECT STATION
          // =================================================

          await page.click("#rc_select_1");

          await page.type("#rc_select_1", stationName);

          await page.waitForSelector(".ant-select-item-option");

          await page.evaluate((station) => {
            const normalize = (str) =>
              str.toLowerCase().replace(/\s+/g, " ").trim();

            const target = normalize(station);

            const items = document.querySelectorAll(".ant-select-item-option");

            for (const el of items) {
              const text = normalize(el.innerText);

              if (text === target) {
                el.click();
                return;
              }
            }
          }, stationName);

          await new Promise((resolve) => setTimeout(resolve, 1500));

          // =================================================
          // CREATE STATION RESULT
          // =================================================

          const stationResult = {
            circle_name,
            station_name: stationName,
            fields: {},
          };

          // =================================================
          // SELECT ACTION STATUS => Approved
          // =================================================

          await page.click("#rc_select_6");

          await page.type("#rc_select_6", "Approved");

          await page.waitForSelector(".ant-select-item-option");

          await page.evaluate(() => {
            const normalize = (str) =>
              str.toLowerCase().replace(/\s+/g, " ").trim();

            const target = normalize("Approved");

            const items = document.querySelectorAll(".ant-select-item-option");

            for (const el of items) {
              const text = normalize(el.innerText);

              if (text === target) {
                el.click();
                return;
              }
            }
          });

          await new Promise((resolve) => setTimeout(resolve, 1500));

          // =====================================================
          // RECORD FIELDS
          // =====================================================

          const recordFields_Beat = [
            {
              key: "Beat_Approved_chowki",
              label: "Chowki Incharge",
            },
            {
              key: "Beat_Approved_sho",
              label: "SHO",
            },
            {
              key: "Beat_Approved_co",
              label: "CO",
            },
          ];

          // =====================================================
          // FIELD LOOP
          // =====================================================

          for (const recordField of recordFields_Beat) {
            try {
              console.log("Processing Field =>", recordField.label);

              // =============================================
              // CLEAR OLD FIELD
              // =============================================

              await page.evaluate(() => {
                const input = document.querySelector("#rc_select_9");

                if (!input) return;

                const select = input.closest(".ant-select");

                if (!select) return;

                const clearBtn = select.querySelector(".ant-select-clear");

                if (clearBtn) clearBtn.click();
              });

              await new Promise((resolve) => setTimeout(resolve, 1000));

              // =============================================
              // OPEN SELECT LEVEL
              // =============================================

              await page.click("#rc_select_9");

              await new Promise((resolve) => setTimeout(resolve, 1000));

              // =============================================
              // SELECT FIELD
              // =============================================

              await page.evaluate((fieldName) => {
                const normalize = (str) =>
                  str.toLowerCase().replace(/\s+/g, " ").trim();

                const target = normalize(fieldName);

                const items = document.querySelectorAll(
                  ".ant-select-item-option",
                );

                for (const el of items) {
                  const text = normalize(el.innerText);

                  if (text === target) {
                    el.click();
                    return;
                  }
                }
              }, recordField.label);

              await new Promise((resolve) => setTimeout(resolve, 1500));

              // =============================================
              // APPLY
              // =============================================

              await page.evaluate(() => {
                const btn = [...document.querySelectorAll("button")].find(
                  (b) => b.innerText.trim() === "Apply",
                );

                if (btn) btn.click();
              });

              // =============================================
              // WAIT RESULT
              // =============================================

              await page.waitForFunction(
                () => {
                  const el = document.querySelector(".table-pagination p span");

                  if (!el) return false;

                  return /^[0-9,]+$/.test(el.innerText.trim());
                },
                {
                  timeout: 120000,
                  polling: 500,
                },
              );

              await new Promise((resolve) => setTimeout(resolve, 1000));

              // =============================================
              // GET RESULT
              // =============================================

              let fieldResult = "0";

              try {
                fieldResult = await page.$eval(
                  ".table-pagination p span",
                  (el) => el.innerText.trim(),
                );

                if (!/^[0-9,]+$/.test(fieldResult)) {
                  fieldResult = "0";
                }
              } catch (err) {
                fieldResult = "0";
              }

              // =============================================
              // SAVE RESULT
              // =============================================

              stationResult.fields[recordField.key] = fieldResult;

              console.log(
                "Circle =>",
                circle_name,
                "| Station =>",
                stationName,
                "| Field =>",
                recordField.label,
                "| Result =>",
                fieldResult,
              );

              // =============================================
              // CLEAR FIELD AFTER APPLY
              // =============================================

              // CLEAR FIELD AFTER APPLY
              // remove selected tags like:
              // Chowki Incharge ×
              // +2...
              // =============================================

              await page.evaluate(() => {
                const input = document.querySelector("#rc_select_9");

                if (!input) return;

                const select = input.closest(".ant-select");

                if (!select) return;

                // ===========================================
                // REMOVE ALL SELECTED ITEMS
                // ===========================================

                const removeButtons = select.querySelectorAll(
                  ".ant-select-selection-item-remove",
                );

                removeButtons.forEach((btn) => {
                  btn.click();
                });

                // ===========================================
                // ALSO CLICK CLEAR BUTTON IF EXISTS
                // ===========================================

                const clearBtn = select.querySelector(".ant-select-clear");

                if (clearBtn) {
                  clearBtn.click();
                }
              });

              //==============================================

              await new Promise((resolve) => setTimeout(resolve, 1000));
            } catch (fieldError) {
              console.log(
                "❌ FIELD ERROR =>",
                stationName,
                "| Field =>",
                recordField.label,
                fieldError.message,
              );

              stationResult.fields[recordField.key] = "0";
            }
          }

          // =================================================
          // SAVE FINAL RESULT
          // =================================================

          finalResults.push(stationResult);

          // =================================================
          // CLEAR APPROVED
          // =================================================

          await page.evaluate(() => {
            const input = document.querySelector("#rc_select_6");

            if (!input) return;

            const select = input.closest(".ant-select");

            if (!select) return;

            const clearBtn = select.querySelector(".ant-select-clear");

            if (clearBtn) clearBtn.click();
          });

          await new Promise((resolve) => setTimeout(resolve, 1000));

          console.log("✅ Station Completed =>", stationName);
        } catch (stationError) {
          console.log("❌ STATION ERROR =>", stationName, stationError.message);
        }
      }
    }

    // =====================================================
    // FINAL RESULTS
    // =====================================================

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

    // const jsondata = await yakshCriminalRecordMyJurisdictionHeaders(page);

    // await exportStationFieldsToExcel(jsondata);

    await yakshBeatSuchnaApproved(page);

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
