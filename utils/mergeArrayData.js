const mergeArrayData = (mergedMap, dataArray) => {
  for (const item of dataArray) {
    const key = `${item.circle_name}__${item.station_name}`;

    // create station object if not exists
    if (!mergedMap[key]) {
      mergedMap[key] = {
        circle_name: item.circle_name,
        station_name: item.station_name,
        fields: {},
      };
    }

    // merge all fields
    mergedMap[key].fields = {
      ...mergedMap[key].fields,
      ...(item.fields || {}),
    };
  }
};
module.exports={mergeArrayData}