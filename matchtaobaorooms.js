var config = require("./auth.conf").mysql;
var jielvapi = require("./jielv-api.js");
var oauth = require("./taobao-oauth.js");
var mysql = require('mysql');
var Promise = require('es6-promise').Promise;

var db = function(querystring) {
    return new Promise(function(resolve, reject) {
        var connection = mysql.createConnection(config);
        connection.connect();
        connection.query(querystring, function(err, rows, fields) {
            if (/^SELECT/.test(querystring)) {
                if (err) rows = [];
                resolve(rows);
            } else if (/^INSERT/.test(querystring)) {
                if (err) resolve(false);
                else resolve(true);
            }
        });
        connection.end();
    });
};

var qs = "SELECT `hotelid`,`namechn`,`taobao_hid` FROM `think_hotel` WHERE `taobao_hid` > 0 LIMIT 4000,1000";
db(qs).then(function(hotels) {
    hotels.reduce(function(sequence, hotel) {
        var mapping = {};

        return sequence.then(function() {
            return oauth.accessProtectedResource(null, null, {
                "hid": hotel.taobao_hid,
                "method": "taobao.hotel.get",
                "need_room_type": true
            }, "");
        }).then(function(result) {
            if (result && result["hotel_get_response"]) {
                result = result["hotel_get_response"]["hotel"];
                result = result["room_types"];
                if (result) {
                    result = result["room_type"];
                } else {
                    result = [];
                    console.log("NO_ROOM_TYPES", hotel.taobao_hid)
                }
            } else {
                result = [];
            }

            result.forEach(function(r) {mapping[r.name] = r.rid;});
            return db("SELECT `roomtypeid`,`namechn` FROM `think_room` WHERE `hotelid` = " + hotel.hotelid);
        }).then(function(result) {
            result = result || [];
            result.forEach(function(r) {
                var rid = mapping[r.namechn];
                if (rid) {
                    db("UPDATE `think_room` SET `status` = 128, `taobao_rid` = " + rid + " WHERE `roomtypeid` = " + r.roomtypeid);
                } else {
                    db("UPDATE `think_room` SET `status` = 1 WHERE `roomtypeid` = " + r.roomtypeid);
                }
            });
        })["catch"](function(e) {
            console.log(e);
        });
    }, Promise.resolve());
});
