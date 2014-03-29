var config = require("./auth.conf").mysql;
var jielvapi = require("./jielv-api.js");
var mapping = require("./define.conf");
var mysql = require('mysql');
var oauth = require("./taobao-oauth.js");
var Promise = require('es6-promise').Promise;

var connection = mysql.createConnection(config);
var db = function(querystring) {
    return new Promise(function(resolve, reject) {
        connection.query(querystring, function(err, rows, fields) {
            if (/^SELECT/.test(querystring)) {
                if (err) {
                    console.log(err.toString());
                    rows = [];
                }
                resolve(rows);
            } else {
                if (err) {
                    console.log(err.toString());
                    resolve(false);
                } else {
                    resolve(true);
                }
            }
        });
    });
};
connection.connect();

var qs = "SELECT `hotelid`,`namechn`,`country`,`state` FROM `think_hotel` WHERE `taobao_hid` = 0 LIMIT 50,50";
db(qs).then(function(hotels) {
    var start = +(new Date());
    var promises = [];
    var promise;
    hotels.forEach(function(hotel) {
        var params = {
            "method": "taobao.hotel.name.get",
            "name": hotel.namechn
        };
        if (mapping.province[hotel.state]) {
            params["domestic"] = true;
            params["province"] = mapping.province[hotel.state] && mapping.province[hotel.state][1];
        } else {
            params["domestic"] = false;
            params["country"] = mapping.country[hotel.country] && mapping.country[hotel.country][1];
        }

        promise = oauth.accessProtectedResource(null, null, params, require("./auth.conf").token);
        promise = promise.then(function(result) {
            if (result && result["hotel_name_get_response"])
                result = result["hotel_name_get_response"]["hotel"];
            else if (result["error_response"])
                console.log(result["error_response"]["msg"]);

            if (result && result.hid) {
                console.log("MATCHED", hotel.namechn);

                var qs = "UPDATE `think_hotel` SET `taobao_hid` = ";
                qs += (result.hid + " WHERE `hotelid` = " + hotel.hotelid);
                return db(qs);
            }
        })["catch"](function(e) {console.log(e);});
        promises.push(promise);
    });

    Promise.all(promises).then(function(result) {
        var total = 0;
        var now = +(new Date());

        result.forEach(function(success) {if (success) total += 1;});
        console.log("success:", total, ",time:", now - start, "milliseconds");
        connection.end();
    });
})["catch"](function(e) {console.log(e);});
