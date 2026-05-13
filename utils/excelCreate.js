const{recordFields_excel}=require("../data/fieldNames");

const path = require("path");
const ExcelJS = require("exceljs");

const exportStationFieldsToExcel = async (data,fileName = "station_report.xlsx",) => {
  

  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Station Report");

  // Create Date-Time String
  const now = new Date();

  const formattedDateTime = `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(
    now.getHours(),
  ).padStart(2, "0")}-${String(now.getMinutes()).padStart(
    2,
    "0",
  )}-${String(now.getSeconds()).padStart(2, "0")}`;

  // Add Date-Time to File Name
  const ext = path.extname(fileName); // .xlsx
  const baseName = path.basename(fileName, ext);

  const finalFileName = `${baseName}_${formattedDateTime}${ext}`;

  

  // Header Row
  worksheet.columns = [
    { header: "Circle Name", key: "circle_name", width: 25 },
    { header: "Station Name", key: "station_name", width: 25 },

    ...recordFields_excel.map((field) => ({
      header: field,
      key: field,
      width: 18,
    })),
  ];

  // Add Rows
  data.forEach((item) => {
    const row = {
      circle_name: item.circle_name,
      station_name: item.station_name,
    };

    recordFields_excel.forEach((field) => {
      row[field] = item.fields[field] || "0";
    });

    worksheet.addRow(row);
  });

  // Header Style
  worksheet.getRow(1).font = {
    bold: true,
  };

  worksheet.getRow(1).alignment = {
    vertical: "middle",
    horizontal: "center",
  };

  // Border for all cells
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };

      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
      };
    });
  });

  // Save File
  await workbook.xlsx.writeFile(finalFileName);

  console.log(`Excel file created: ${finalFileName}`);

  return finalFileName;
};


module.exports={exportStationFieldsToExcel}