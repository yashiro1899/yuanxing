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

var fields1 = "`hid`,`hotelid`,`original`";
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
            var data = [],
                inserted = [];
            var promise = oauth.accessProtectedResource(null, null, params, token);
            promise = promise.then(function(result) { // taobao.hotels.search
                var total;
                var hids = [];

                if (result && result["hotels_search_response"]) {
                    total = result["hotels_search_response"]["total_results"];
                    result = total > 0 ? result["hotels_search_response"]["hotels"]["hotel"] : [];
                    if (total > 20) console.log("GREATER THAN 20,", total, hotel.namechn);
                } else if (result["error_response"]) {
                    result = [];
                    console.log(result["error_response"]["msg"]);
                }

                result.forEach(function(h) {
                    var a = h.name.indexOf(hotel.namechn);
                    var b = hotel.namechn.indexOf(h.name);
                    if (a > -1 || b > -1) hids.push(h.hid);
                });
                if (hids.length === 0) throw "NO_MATCHED " + hotel.namechn;

                data = result.filter(function(h) {return hids.indexOf(h.hid) > -1;});
                return db("SELECT `hid` FROM `think_taobaohotel` WHERE `hid` in (" + hids.join(',') + ")");
            }).then(function(result) { // think_taobaohotel
                var ids = result.map(function(h) {return h.hid;});
                var sqls = [];

                var values = data.map(function(h) {
                    var v = [];
                    v.push(h.hid);
                    v.push(hotel.hotelid);
                    v.push(JSON.stringify(JSON.stringify(h)));

                    if (ids.indexOf(h.hotelid) > -1) {
                        var qs = "UPDATE `think_taobaohotel` SET ";
                        var f = fields1.split(",");
                        v.forEach(function(value, index) {
                            if (index === 0) return null;
                            if (index > 1) qs += ",";
                            qs += f[index];
                            qs += "=";
                            qs += value;
                        });
                        qs += " WHERE `hid`=" + h.hid;
                        sqls.push(db(qs));
                    }
                    return v;
                });

                values = values.filter(function(h) {return ids.indexOf(h[0]) < 0;});
                inserted = values.map(function(h) {return h[0];});
                values = values.map(function(h) {return "(" + h.join(",") + ")";});
                if (values.length > 0)
                    sqls.push(db("INSERT INTO `think_taobaohotel` (" + fields1 + ") VALUES " + values.join(",")));
                return Promise.all(sqls);
            }).then(function(result) { // think_taobaohotel
                if (inserted.length > 0 && !result.pop()) console.log("HOTEL_ERROR", inserted.join(","));

                total1 += data.length;
                var promises = [];
                var model;

                data.forEach(function(h) {
                    promises.push(oauth.accessProtectedResource(null, null, {
                        "hid": h.hid,
                        "method": "taobao.hotel.get",
                        "need_room_type": true
                    }, token));
                });
                model = db("SELECT `roomtypeid`, `namechn` FROM `think_room` WHERE `hotelid` = " + hotel.hotelid);
                return Promise.all([Promise.all(promises), model]);
            }).then(function(result) { // taobao.hotel.get
                data = [];
                result[0].forEach(function(h) {
                    var roomtypes = [];
                    if (h && h["hotel_get_response"]) {
                        h = h["hotel_get_response"]["hotel"];
                        roomtypes = h.room_types["room_type"] || [];
                        roomtypes.forEach(function(r, i) {roomtypes[i]["hid"] = h.hid;});
                        data = data.concat(roomtypes);
                    }
                });
                if (data.length === 0) throw "NO_ROOM_TYPE " + hotel.namechn;

                console.log(JSON.stringify(result[1], null, 4));
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
