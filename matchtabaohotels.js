var config = require("./auth.conf").mysql;
var areacode = require("./areacode.conf");
var jielvapi = require("./jielv-api.js");
var oauth = require("./taobao-oauth.js");
var mysql = require('mysql');
var Promise = require('es6-promise').Promise;

var db = function(querystring, method) {
    return new Promise(function(resolve, reject) {
        var connection = mysql.createConnection(config);
        connection.connect();
        connection.query(querystring, function(err, rows, fields) {
            if (err) rows = [];
            resolve(rows);
        });
        connection.end();
    });
};

var total = 0;
var start = +(new Date());
db("SELECT `hotelid`,`namechn`,`state` FROM `think_hotel`").then(function(hotels) {
    hotels.reduce(function(sequence, hotel) {
        return sequence.then(function() {
            return oauth.accessProtectedResource(null, null, {
                "domestic": true,
                "method": "taobao.hotel.name.get",
                "name": hotel.namechn,
                "province": areacode.province[hotel.state] && areacode.province[hotel.state][1]
            }, "token");
        }).then(function(result) {
            if (result && result["hotel_name_get_response"]) {
                result = result["hotel_name_get_response"]["hotel"];
            }
            if (result && result.hid) {
                total += 1;
                return db("UPDATE `think_hotel` set `taobao_hid` = " + result.hid + " WHERE `hotelid` = " + hotel.hotelid);
            } else {
                console.log('NO_MATCH', hotel.namechn);
            }
        }).then(function(result) {
            var now = +(new Date());
            console.log("total:", total, ",time:", now - start, "milliseconds");
        }).catch(function(e) {
            console.log(e);
        });
    }, Promise.resolve());
});
