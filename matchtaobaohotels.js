var config = require("./auth.conf").mysql;
var jielvapi = require("./jielv-api.js");
var mapping = require("./define.conf");
var mysql = require('mysql');
var oauth = require("./taobao-oauth.js");
var token = require("./auth.conf").token;
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

var qs = "SELECT `hotelid`,`namechn`,`country`,`state` FROM `think_hotel` ";
qs += "ORDER BY `hotelid` LIMIT 1";
db(qs).then(function(hotels) {
    var total1 = 0, total2 = 0;
    var start = +(new Date());
    var promises = [];
    hotels.forEach(function(hotel) {
        var params = {
            "method": "taobao.hotels.search",
            "name": hotel.namechn
        };
        if (mapping.province[hotel.state]) {
            params["domestic"] = true;
            params["province"] = mapping.province[hotel.state] && mapping.province[hotel.state][1];
        } else {
            params["domestic"] = false;
            params["country"] = mapping.country[hotel.country] && mapping.country[hotel.country][1];
        }

        (function(params) {
            var data = [];
            var promise = oauth.accessProtectedResource(null, null, params, token);
            promise = promise.then(function(result) {
                var total;
                var hids = [];

                if (result && result["hotels_search_response"]) {
                    total = result["hotels_search_response"]["total_results"];
                    result = total > 0 ? result["hotels_search_response"]["hotels"]["hotel"] : [];
                } else if (result["error_response"]) {
                    result = [];
                    console.log(result["error_response"]["msg"]);
                }

                if (result.length === 0) throw "NO_MATCHED " + hotel.namechn;

                data = result;
                data.forEach(function(h) {
                    var a = h.name.indexOf(hotel.namechn);
                    var b = hotel.namechn.indexOf(h.name);
                    if (a > -1 || b > -1) hids.push(h.hid);
                });
            //     if (result && result.hid) {
            //         taobao_hid = result.hid;

            //         var qs = "UPDATE `think_hotel` SET `taobao_hid` = ";
            //         qs += (result.hid + " WHERE `hotelid` = " + hotel.hotelid);
            //         return db(qs);
            //     }
            //
            // }).then(function(result) {
            //     if (result) total1 += 1;

            //     return oauth.accessProtectedResource(null, null, {
            //         "hid": taobao_hid,
            //         "method": "taobao.hotel.get",
            //         "need_room_type": true
            //     }, token);
            // }).then(function(result) {
            //     if (result && result["hotel_get_response"]) {
            //         result = result["hotel_get_response"]["hotel"];
            //         result = result["room_types"];
            //         result = (result ? result["room_type"] : []);
            //     } else {
            //         result = [];
            //     }

            //     if (result.length === 0) throw "NO_ROOM_TYPE " + hotel.namechn;
            //     result.forEach(function(r) {roomtypes[r.name] = r.rid;});
            //     return db("SELECT `roomtypeid`,`namechn` FROM `think_room` WHERE `hotelid` = " + hotel.hotelid);
            // }).then(function(result) {
            //     result = result || [];

            //     var sqls = [];
            //     result.forEach(function(r, i) {
            //         var rid = roomtypes[r.namechn];
            //         var qs = "UPDATE `think_room` SET ";
            //         if (rid) {
            //             result[i]["matched"] = true;
            //             qs += "`status`=128, `taobao_rid`=" + rid + " WHERE`roomtypeid` = " + r.roomtypeid;
            //             sqls.push(db(qs));
            //         } else {
            //             qs += "`status`=1 WHERE `roomtypeid` = " + r.roomtypeid;
            //             sqls.push(db(qs));
            //         }
            //     });
            //     roomtypes = result;
            //     return Promise.all(sqls);
            // }).then(function(result) {
            //     roomtypes.forEach(function(r, i) {
            //         if (r.matched && result[i]) total2 += 1;
            //     });
            })["catch"](function(e) {console.log(e);});
            promises.push(promise);
        })(params);
    });

    Promise.all(promises).then(function(result) {
        var now = +(new Date());
        console.log("hotel success:", total1, "room success:", total2, ",time:", now - start, "milliseconds");
        connection.end();
    });
})["catch"](function(e) {console.log(e);});
