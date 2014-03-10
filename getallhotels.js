var jielvapi = require("./jielv-api.js");
var Promise = require('es6-promise').Promise;

var data = [];
var i = 0, j, hotelIds;
for (; i < 510; i += 1) {
    hotelIds = [];
    for (j = (i * 20 + 1); j <= ((i + 1) * 20); j += 1) hotelIds.push(j);
    hotelIds = hotelIds.join("/")
    data.push(hotelIds);
}

console.log(+(new Date()));
data.reduce(function(sequence, ids) {
    return jielvapi({
        "QueryType": "hotelinfo",
        "hotelIds": ids
    }).then(function(result) {
        if (!result) return false;

        console.log(ids + " ----------> " + result.data.length);
        console.log(+(new Date()));
    });
}, Promise.resolve());
