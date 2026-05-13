// ================= GROUP FUNCTION =================
const groupCircleStations = (circle_station) => {
  return circle_station.reduce((acc, row) => {
    if (!acc[row.circle_name]) {
      acc[row.circle_name] = [];
    }

    acc[row.circle_name].push(row.station_name);

    return acc;
  }, {});
};

const getCircleNames = (circle_station) => {
  return [...new Set(circle_station.map(item => item.circle_name))];
};
module.exports={groupCircleStations, getCircleNames};