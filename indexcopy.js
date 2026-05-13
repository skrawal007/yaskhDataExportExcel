require("dotenv").config();

const {circle_station}=require("./data/stationData")
const{recordFields_info,recordFields_Juridiction,recordFields_Juridiction_dcrb}=require("./data/fieldNames");
const {groupCircleStations,getCircleNames}=require("./utils/groupCircleStation");
const {mergeArrayData}=require("./utils/mergeArrayData");
const {exportStationFieldsToExcel}=require("./utils/excelCreate");
const puppeteer = require("puppeteer");



const yakshCriminalRecordMyJurisdictionDcrb = async (page) => {
 

 
  
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

    // ================= CIRCLE LOOP =================

    for (const circle_name of Object.keys(grouped)) {
      const stations = grouped[circle_name];

      // ================= SELECT CIRCLE =================

      await page.click("#rc_select_0");

      await page.type(
        "#rc_select_0",
        circle_name.replace("CIRCLE ", ""),
      );

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

      await new Promise((resolve) => setTimeout(resolve, 1500));

      // ================= STATION LOOP =================

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


        // ================= STATION RESULT OBJECT =================
        const stationResult = {
          circle_name: circle_name,
          station_name: stationName,
          fields: {},
        };

// =====================================================
// ================= STATUS LOOP =======================
// =====================================================
  for (const field of recordFields_Juridiction_dcrb) {
          // ================= CLEAR OLD FIELD =================
          await page.evaluate(() => {
            const allSelects = document.querySelectorAll(".ant-select");

            // third select = Select Record
            const select = allSelects[5];

            if (!select) return;

            const clearBtn = select.querySelector(".ant-select-clear");

            if (clearBtn) {
              clearBtn.dispatchEvent(
                new MouseEvent("mousedown", { bubbles: true }),
              );

              clearBtn.click();
            }
          });

          await new Promise((resolve) => setTimeout(resolve, 1000));

          // ================= OPEN SELECT RECORD =================
          await page.evaluate(() => {
            const allSelects = document.querySelectorAll(".ant-select");

            const select = allSelects[5];

            if (!select) return;

            const selector = select.querySelector(".ant-select-selector");

            if (selector) selector.click();
          });

          await new Promise((resolve) => setTimeout(resolve, 1000));

          // ================= TYPE FIELD =================
          const inputs = await page.$$(".ant-select-selection-search-input");

          const input = inputs[5];

          if (!input) {
            console.log("INPUT NOT FOUND");
            continue;
          }

          await input.click({ clickCount: 3 });

          await page.keyboard.press("Backspace");

          await input.type(field, {
            delay: 70,
          });

          // ================= WAIT OPTIONS =================
          await page.waitForFunction(() => {
            return (
              document.querySelectorAll(".ant-select-item-option").length > 0
            );
          });

          // ================= SELECT EXACT OPTION =================
          const selected = await page.evaluate((fieldName) => {
            const normalize = (str) =>
              str
                .toLowerCase()
                .replace(/[^a-z0-9 ]/g, "")
                .replace(/\s+/g, " ")
                .trim();

            const target = normalize(fieldName);

            const items = document.querySelectorAll(".ant-select-item-option");

            for (const el of items) {
              const text = normalize(el.innerText);

              if (text === target) {
                el.click();
                return true;
              }
            }

            return false;
          }, field);

          // if (!selected) {
          //   console.log("NOT FOUND =>", field);
          //   continue;
          // }

if (!selected) {
  console.log("NOT FOUND =>", field, "| APPLY EMPTY SELECTION");

  // ================= FULL CLEAR =================
  await page.evaluate(() => {
    const allSelects = document.querySelectorAll(".ant-select");

    const select = allSelects[5];

    if (!select) return;

    // clear selected tag/value
    const clearBtn = select.querySelector(".ant-select-clear");

    if (clearBtn) {
      clearBtn.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true })
      );

      clearBtn.click();
    }

    // clear hidden input
    const input = select.querySelector("input");

    if (input) {
      input.value = "";

      input.dispatchEvent(
        new Event("input", { bubbles: true })
      );

      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Backspace",
          bubbles: true,
        })
      );
    }
  });

  // close dropdown
  await page.keyboard.press("Escape");

  await new Promise((resolve) => setTimeout(resolve, 2000));

  // ================= APPLY =================
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.innerText.trim() === "Apply"
    );

    if (btn) btn.click();
  });

  // ================= WAIT RESULT =================
  await page.waitForFunction(
    () => {
      const el = document.querySelector(".table-pagination p span");

      if (!el) return false;

      return /^[0-9,]+$/.test(el.innerText.trim());
    },
    {
      timeout: 120000,
      polling: 500,
    }
  );

  await new Promise((resolve) => setTimeout(resolve, 1500));

  // ================= GET RESULT =================
  let totalResult = "0";

  try {
    totalResult = await page.$eval(
      ".table-pagination p span",
      (el) => el.innerText.trim()
    );

    if (!/^[0-9,]+$/.test(totalResult)) {
      totalResult = "0";
    }
  } catch (err) {
    totalResult = "0";
  }

  // ================= SAVE RESULT =================
  stationResult.fields[field] = totalResult;

  console.log(
    "Circle =>",
    circle_name,
    "| Station =>",
    stationName,
    "| Field =>",
    field,
    "| EMPTY FILTER RESULT =>",
    totalResult
  );

  continue;
}

          await new Promise((resolve) => setTimeout(resolve, 1500));

          await page.evaluate(() => {
            const btn = [...document.querySelectorAll("button")].find(
              (b) => b.innerText.trim() === "Apply",
            );

            if (btn) btn.click();
          });

          // ================= WAIT FOR RESULT =================
          await new Promise((resolve) => setTimeout(resolve, 1000));

          await page.waitForFunction(
            () => {
              const el = document.querySelector(".table-pagination p span");

              if (!el) return false;

              const text = el.innerText.trim();

              // must contain valid number
              return /^[0-9,]+$/.test(text);
            },
            {
              timeout: 120000,
              polling: 500,
            },
          );

                    await new Promise((resolve) => setTimeout(resolve, 1000));

          // ================= GET RESULT =================
          // ================= GET RESULT =================

          let totalResult = "0";

          try {
            totalResult = await page.$eval(".table-pagination p span", (el) =>
              el.innerText.trim(),
            );

            if (!/^[0-9,]+$/.test(totalResult)) {
              totalResult = "0";
            }
          } catch (err) {
            totalResult = "0";
          }

          // save field result
          stationResult.fields[field] = totalResult;

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
        }
// =====================================================
// ================= FINAL RESULT ======================
// =====================================================

          finalResults.push(stationResult);


          console.log("✅ Station Completed =>", stationName);
        } catch (stationError) {
          console.log("❌ STATION ERROR =>", stationName, stationError.message);
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


    await yakshCriminalRecordMyJurisdiction(page);
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





