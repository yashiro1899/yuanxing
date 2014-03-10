var jielvapi = require("./jielv-api.js");
var Promise = require('es6-promise').Promise;

var data = [];
var i = 0, j, hotelIds;
for (; i < 5; i += 1) {
    hotelIds = [];
    for (j = (i * 20 + 1); j <= ((i + 1) * 20); j += 1) hotelIds.push(j);
    hotelIds = hotelIds.join("/")
    data.push(hotelIds);
}

data.reduce(function(sequence, ids) {
    return jielvapi({
        "QueryType": "hotelinfo",
        "hotelIds": ids
    }).then(function(result) {
        if (!result) return false;

        result.data.forEach(function(hotel) {
            if (hotel.namechn == "香港万怡酒店") {
                var roomtypeids = [];
                hotel.rooms.forEach(function(room) {
                    roomtypeids.push(room.roomtypeid);
                });

                jielvapi({
                    "QueryType": "hotelpriceall",
                    "roomtypeids": roomtypeids.join("/"),
                    "checkInDate": "2014-03-11",
                    "checkOutDate": "2014-03-14"
                }).then(function(price) {
                    price = JSON.stringify(price);
                    console.log(price)
                });
            }
        });
    });
}, Promise.resolve());
