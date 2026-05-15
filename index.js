require("dotenv").config();
const {circle_station}=require("./data/stationData")
const{recordFields_info,recordFields_Juridiction,recordFields_Juridiction_dcrb}=require("./data/fieldNames");
const {groupCircleStations,getCircleNames}=require("./utils/groupCircleStation");
const {mergeArrayData}=require("./utils/mergeArrayData");
const {exportStationFieldsToExcel}=require("./utils/excelCreate");
const puppeteer = require("puppeteer");



const yakshMissingRecordInfoPage = async (page) => {
  await page.goto("https://yaksh.ai/panel/missing-record-information", {
    waitUntil: "domcontentloaded",
  });

  await page.waitForSelector("#rc_select_0");


  try {
    
   // ================= GROUP DATA =================


    const grouped = await groupCircleStations(circle_station);

    // ================= FINAL RESULT ARRAY =================
    const finalResults = [];

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

          // ================= CLEAR OLD STATION =================
          // this part is important because when we select new station, old station value is not cleared properly which causes wrong results or no results. so we need to clear old station value before selecting new station.
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
        for (const field of recordFields_info) {
          // ================= CLEAR OLD FIELD =================
          await page.evaluate(() => {
            const allSelects = document.querySelectorAll(".ant-select");

            // third select = Select Record
            const select = allSelects[2];

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

            const select = allSelects[2];

            if (!select) return;

            const selector = select.querySelector(".ant-select-selector");

            if (selector) selector.click();
          });

          await new Promise((resolve) => setTimeout(resolve, 1000));

          // ================= TYPE FIELD =================
          const inputs = await page.$$(".ant-select-selection-search-input");

          const input = inputs[2];

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

          //=========================================================
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

          let totalResult ;

          try {
            totalResult = await page.$eval(".table-pagination p span", (el) =>
              el.innerText.trim(),
            );

            if (!/^[0-9,]+$/.test(totalResult)) {
              totalResult = "0";
            }
          } catch (err) {
            totalResult = "NF";
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

        // push complete station data
        finalResults.push(stationResult);

        console.log("✅ Station Completed =>", stationName);
      }
      // await page.reload({ waitUntil: "networkidle2" });
      // await page.waitForSelector("#rc_select_0");
    }
    console.log("================ FINAL RESULTS ================");

    console.log(JSON.stringify(finalResults, null, 2));

    // ================= RETURN JSON =================
    return finalResults;
  } catch (error) {
    console.log("ERROR =>", error);

    return [];
  } 
};

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


const yakshCriminalRecordMyJurisdiction = async (page) => {
 

 
  
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
  await page.click('[data-node-key="incorrect_address"]');

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
  for (const field of recordFields_Juridiction) {
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


const yakshBeatSuchna = async (page) => {
  await page.goto("https://yaksh.ai/panel/view-beat-suchana", {
    waitUntil: "domcontentloaded",
  });

  await page.waitForSelector("#rc_select_0");


  try {

    //     // ================= GROUP DATA =================


    const grouped = await groupCircleStations(circle_station);

    // ================= FINAL RESULT =================
    const finalResults = [];


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

            if (clearBtn) clearBtn.click();
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

          // ================= APPLY =================
          await page.evaluate(() => {
            const btn = [...document.querySelectorAll("button")].find(
              (b) => b.innerText.trim() === "Apply",
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
            },
          );

          await new Promise((resolve) => setTimeout(resolve, 1000));

          // ================= GET RESULT =================
          let totalResult = "0";

          try {
            totalResult = await page.$eval(
              ".table-pagination p span",
              (el) => el.innerText.trim(),
            );

            if (!/^[0-9,]+$/.test(totalResult)) {
              totalResult = "0";
            }
          } catch (err) {
            totalResult = "0";
          }

          // ================= SAVE RESULT =================
          const stationResult = {
            circle_name: circle_name,
            station_name: stationName,
            fields: {
              beat_suchna: totalResult,
            },
          };

          finalResults.push(stationResult);

          console.log(
            "Circle =>",
            circle_name,
            "| Station =>",
            stationName,
            "| Beat Suchna =>",
            totalResult,
          );

          console.log("✅ Station Completed =>", stationName);
        } catch (stationError) {
          console.log(
            "❌ STATION ERROR =>",
            stationName,
            stationError.message,
          );
        }
      }

      // ================= RELOAD PAGE =================
      await page.reload({
        waitUntil: "networkidle2",
      });

      await page.waitForSelector("#rc_select_0");
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


const crimanlVerificationData = async (page) => {
  await page.goto("https://yaksh.ai/panel/performance-panel", {
    waitUntil: "domcontentloaded",
  });

  // ================= WAIT TAB =================
  await page.waitForSelector(".ant-tabs-nav-list", {
    visible: true,
    timeout: 60000,
  });

  // ================= CLICK TAB =================
  await page.click('[data-node-key="5"]');

  await new Promise((resolve) => setTimeout(resolve, 3000));

  try {
    // ================= FINAL RESULT =================
    const finalResults = [];

    const circleNames = getCircleNames(circle_station);

    if (circleNames.length === 0) {
      console.log("No circle names found");
      return [];
    }

    // ================= LOG CIRCLE NAMES =================


    if (circleNames.length === 0) {
      console.log("No circle names found in the data.");
      return [];
    }
    console.log("Circle Names =>", circleNames[0]);
      // ================= SELECT CIRCLE =================
   



            // wait table load
            await page.waitForSelector(".ant-table-tbody .ant-table-row", {
              visible: true,
              timeout: 30000,
            });

            // click row where circle name matches
            await page.evaluate((targetCircle) => {
              const rows = document.querySelectorAll(
                ".ant-table-tbody .ant-table-row"
              );

              for (const row of rows) {
                const cells = row.querySelectorAll(".ant-table-cell");

                // 2nd column = Circle Name
                const circleText = cells[1]?.innerText?.trim();

                if (circleText === targetCircle) {
                  row.click();
                  break;
                }
              }
            }, circleNames[0]);

            console.log("✅ Clicked =>", circleNames[0]);


    // ================= LOG CIRCLE NAMES =================
    // ================= LOOP ALL CIRCLES =================
    for (const circleName of circleNames) {
      try {
        console.log("======================================");
        console.log("SELECTING CIRCLE =>", circleName);

        // ================= WAIT SELECT =================
        await page.waitForSelector(".ant-select", {
          visible: true,
          timeout: 30000,
        });

        // ================= CLEAR OLD CIRCLE =================
        await page.evaluate(() => {
          const selects = document.querySelectorAll(".ant-select");

          for (const select of selects) {
            const selected = select.querySelector(
              ".ant-select-selection-item"
            );

            if (
              selected &&
              selected.innerText.trim().startsWith("CIRCLE")
            ) {
              const clearBtn =
                select.querySelector(".ant-select-clear");

              if (clearBtn) {
                clearBtn.dispatchEvent(
                  new MouseEvent("mousedown", {
                    bubbles: true,
                  })
                );

                clearBtn.click();
              }

              break;
            }
          }
        });

        await new Promise((resolve) => setTimeout(resolve, 1000));

        // ================= OPEN DROPDOWN =================
        await page.click("#rc_select_2");

        // ================= TYPE CIRCLE =================
        await page.type("#rc_select_2", circleName);

        // ================= WAIT OPTIONS =================
        await page.waitForSelector(".ant-select-item-option", {
          visible: true,
          timeout: 30000,
        });

        // ================= SELECT OPTION =================
        await page.evaluate((target) => {
          const options = document.querySelectorAll(
            ".ant-select-item-option"
          );

          for (const option of options) {
            const text = option.innerText.trim();

            if (text === target) {
              option.click();
              break;
            }
          }
        }, circleName);

        console.log("✅ SELECTED =>", circleName);

        await new Promise((resolve) => setTimeout(resolve, 1500));

        // ================= CLICK APPLY =================
        await page.evaluate(() => {
          const buttons = document.querySelectorAll("button");

          for (const btn of buttons) {
            const text = btn.innerText.trim();

            if (text === "Apply") {
              btn.click();
              break;
            }
          }
        });

        console.log("🚀 APPLY CLICKED");

        // ================= WAIT TABLE LOAD =================
        await page.waitForSelector(
          ".ant-table-tbody .ant-table-row",
          {
            visible: true,
            timeout: 60000,
          }
        );

        await new Promise((resolve) => setTimeout(resolve, 3000));

        // ================= GET TABLE DATA =================
        const tableData = await page.evaluate((circleName) => {
          const rows = document.querySelectorAll(
            ".ant-table-tbody .ant-table-row"
          );

          const results = [];

          rows.forEach((row) => {
            const cells = row.querySelectorAll(".ant-table-cell");

            if (cells.length < 9) return;

            const cleanNumber = (value) => {
              return value.replace(/,/g, "").trim();
            };

            const stationName =
              cells[1]?.innerText?.trim() || "";

            const totalCriminal = cleanNumber(
              cells[2]?.innerText || "0"
            );

            const verifiedByBeatOfficer = cleanNumber(
              cells[3]?.innerText || "0"
            );

            const incorrectAddress = cleanNumber(
              cells[4]?.innerText || "0"
            );

            const totalVerified = cleanNumber(
              cells[5]?.innerText || "0"
            );

            const verificationPercentage =
              cells[6]?.innerText?.trim() || "0 %";

            const pendingToVerify = cleanNumber(
              cells[7]?.innerText || "0"
            );

            const pendingPercentage =
              cells[8]?.innerText?.trim() || "0 %";

            results.push({
              circle_name: circleName,

              station_name: stationName,

              // fields: {
              //   total_criminal_for_beat_verification:
              //     totalCriminal,

              //   criminal_verified_by_beat_officer:
              //     verifiedByBeatOfficer,

              //   incorrect_add_reported_by_beat_officer:
              //     incorrectAddress,

              //   total_verified: totalVerified,

              //   verification_percentage:
              //     verificationPercentage,

              //   pending_to_verify: pendingToVerify,

              //   pending_percentage: pendingPercentage,
              // },
              fields: {
              "Total Criminal for Beat Verification":
                totalCriminal,

              "Criminal Verified by Beat Officer":
                verifiedByBeatOfficer,

              "Incorrect Add Reported by Beat Officer":
                incorrectAddress,

              "Total Verified":
                totalVerified,

              "Verification %":
                verificationPercentage,

              "Pending to Verify":
                pendingToVerify,

              "Pending %":
                pendingPercentage,
            },
            });
          });

          return results;
        }, circleName);

        // ================= PUSH FINAL RESULT =================
        finalResults.push(...tableData);

        console.log(
          `✅ ${circleName} COMPLETED | RECORDS =>`,
          tableData.length
        );
      } catch (circleError) {
        console.log(
          "❌ CIRCLE ERROR =>",
          circleName,
          circleError.message
        );
      }
    }

    // ================= FINAL RESULT =================
    console.log("======================================");
    console.log("FINAL RESULTS");
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



const yakshPuppeteerpro = async () => {
  let browser;
  try {

     // ======================================================
    // =================  for mac browser======================
    // ======================================================

    browser = await puppeteer.launch({
      headless: false,

      executablePath:
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",

      userDataDir: "/Users/apple/puppeteer-sessions/chrome-data",

      protocolTimeout: 300000,

      defaultViewport: null,

      ignoreDefaultArgs: ["--enable-automation"],

      args: [
        "--start-maximized",

        // stability
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",

        // reduce crashes
        "--disable-gpu",
        "--disable-crash-reporter",
        "--disable-extensions",
        "--disable-sync",

        // anti detection
        "--disable-blink-features=AutomationControlled",

        // background optimization
        "--disable-renderer-backgrounding",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",

        // site issues
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-features=TranslateUI",

        // memory stability
        "--memory-pressure-off",
        "--max_old_space_size=4096",
      ],
    });


     // ======================================================
     // ================= For windows broswer ===============
     // ======================================================

    //     browser = await puppeteer.launch({
    //      headless: true,

    //   executablePath:
    //     "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",

    //   userDataDir: "C:\\puppeteer-sessions\\chrome-data",

    //   protocolTimeout: 300000,

    //   defaultViewport: null,

    //   ignoreDefaultArgs: ["--enable-automation"],

    //   args: [
    //     "--start-maximized",

    //     // stability
    //     "--no-sandbox",
    //     "--disable-setuid-sandbox",
    //     "--disable-dev-shm-usage",

    //     // reduce crashes
    //     "--disable-gpu",
    //     "--disable-crash-reporter",
    //     "--disable-extensions",
    //     "--disable-sync",

    //     // anti detection
    //     "--disable-blink-features=AutomationControlled",

    //     // background optimization
    //     "--disable-renderer-backgrounding",
    //     "--disable-background-timer-throttling",
    //     "--disable-backgrounding-occluded-windows",

    //     // site issues
    //     "--disable-features=IsolateOrigins,site-per-process",
    //     "--disable-features=TranslateUI",

    //     // memory stability
    //     "--memory-pressure-off",
    //     "--max_old_space_size=4096",
    //   ],
    // });


    // ================= PAGE =================
    const page = await browser.newPage();

    page.setDefaultTimeout(180000);

    page.setDefaultNavigationTimeout(180000);

    await page.goto("https://yaksh.ai", {
      waitUntil: "domcontentloaded",
    });

    // ======================================================
    // ================= GET ALL DATA =======================
    // ======================================================

    // ================= MISSING RECORD =================
    const missingRecordData = await yakshMissingRecordInfoPage(page);

    console.log(
      "================ MISSING RECORD DATA ================",
    );

    console.log(JSON.stringify(missingRecordData, null, 2));


      // ================= CRIMINAL RECORD DCRB Approved =================
    const yakshCriminalRecordMyJurisdictionDcrbData =
      await yakshCriminalRecordMyJurisdictionDcrb(page);

    console.log("================ CRIMINAL RECORD DATA ================",);

    console.log(JSON.stringify(yakshCriminalRecordMyJurisdictionDcrbData,null,2,),);


    // ================= CRIMINAL RECORD =================
    const yakshCriminalRecordMyJurisdictionData =
      await yakshCriminalRecordMyJurisdiction(page);

    console.log(
      "================ CRIMINAL RECORD DATA ================",
    );

    console.log(
      JSON.stringify(
        yakshCriminalRecordMyJurisdictionData,
        null,
        2,
      ),
    );

    // ================= BEAT SUCHNA =================
    const yakshBeatSuchnaData = await yakshBeatSuchna(page);

    console.log(
      "================ BEAT SUCHNA DATA ================",
    );

    console.log(JSON.stringify(yakshBeatSuchnaData, null, 2));

    // ================= CRIMINAL VERIFICATION DATA =================
    const crimanlVerificationDataData = await crimanlVerificationData(page);
    console.log("================ CRIMINAL VERIFICATION DATA ================");

    console.log(JSON.stringify(crimanlVerificationDataData, null, 2));
    // ======================================================
    // ================= MERGE ALL DATA =====================
    // ======================================================

    const mergedMap = {};

    // merge missing record
    mergeArrayData(mergedMap, missingRecordData);

    // merge criminal record dcrb approved
    mergeArrayData(mergedMap,yakshCriminalRecordMyJurisdictionDcrbData,);

    // merge criminal record
    mergeArrayData(mergedMap,yakshCriminalRecordMyJurisdictionData,);

    // merge beat suchna
    mergeArrayData(mergedMap,yakshBeatSuchnaData,);

    // merge criminal verification data
    mergeArrayData(mergedMap,crimanlVerificationDataData);
    // ================= FINAL MERGED ARRAY =================
    const mergedData = Object.values(mergedMap);

    console.log(
      "================ MERGED DATA ================",
    );

    console.log(JSON.stringify(mergedData, null, 2));

    // ======================================================
    // ================= EXPORT EXCEL =======================
    // ======================================================

    await exportStationFieldsToExcel(mergedData);

    console.log("✅ ALL TASK COMPLETED");
  } catch (error) {
    console.error("❌ ERROR =>", error);
  } finally {
    if (browser) {
      console.log("🛑 Closing browser...");

      await browser.close();
    }
  }
};


yakshPuppeteerpro();