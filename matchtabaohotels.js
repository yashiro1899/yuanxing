var config = require("./auth.conf").mysql;
var areacode = require("./define.conf");
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

var total = 0;
var start = +(new Date());
var qs = "SELECT `hotelid`,`namechn`,`state` FROM `think_hotel` WHERE `taobao_hid` = 0 AND `city` < 99999";
db(qs).then(function(hotels) {
    hotels.reduce(function(sequence, hotel) {
        var name = hotel.namechn.trim();
        name = name.replace(/\(.+|（.+$/, "");
        name = name.replace(/^TF/, "");
        name = name.replace(/^FB-/, "");
        hotel.namechn = name;
        return sequence.then(function() {
            return oauth.accessProtectedResource(null, null, {
                "domestic": true,
                "method": "taobao.hotel.name.get",
                "name": hotel.namechn,
                "province": areacode.province[hotel.state] && areacode.province[hotel.state][1]
            }, "");
        }).then(function(result) {
            if (result && result["hotel_name_get_response"]) {
                result = result["hotel_name_get_response"]["hotel"];
            }
            if (result && result.hid) {
                total += 1;
                db("UPDATE `think_hotel` set `taobao_hid` = " + result.hid + " WHERE `hotelid` = " + hotel.hotelid);
            } else {
                console.log('NO_MATCH', hotel.hotelid, hotel.namechn);
            }
        }).catch(function(e) {
            console.log(e);
        });
    }, Promise.resolve());
});
