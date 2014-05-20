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
var fields2 = "`rid`,`hid`,`roomtypeid`";
var qs = "SELECT `hotelid`,`namechn`,`nameeng`,`country`,`state` FROM `think_hotel` ";
qs += "ORDER BY `hotelid` LIMIT 5000";
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
            pushPromise(params);
        } else {
            params["domestic"] = false;
            params["country"] = mapping.country[hotel.country] && mapping.country[hotel.country][1];
            pushPromise(params);

            var another = {};
            Object.keys(params).forEach(function(k) {return another[k] = params[k];});
            another["name"] = hotel.nameeng;
            if (another.name) pushPromise(another);
        }

        function pushPromise(params) {
            var data = [],
                inserted = [],
                roomtypeids = [];
            var promise = oauth.accessProtectedResource(null, null, params, token);
            promise = promise.then(function(result) { // taobao.hotels.search
                var total;
                var hids = [];

                if (result && result["hotels_search_response"]) {
                    total = result["hotels_search_response"]["total_results"];
                    result = total > 0 ? result["hotels_search_response"]["hotels"]["hotel"] : [];
                    if (total > 20) console.log("GREATER THAN 20,", total, params.name);
                } else if (result["error_response"]) {
                    console.log(result["error_response"]["msg"]);
                    result = [];
                }

                result.forEach(function(h) {
                    if (params.name == h.name) hids.push(h.hid);
                });
                if (hids.length === 0) throw "NO_MATCHED " + params.name;

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
                model = db("SELECT `roomtypeid`,`namechn` FROM `think_room` WHERE `hotelid` = " + hotel.hotelid);
                return Promise.all([Promise.all(promises), model]);
            }).then(function(result) { // taobao.hotel.get, think_room
                data = [];
                result[0].forEach(function(h) {
                    if (h && h["hotel_get_response"]) {
                        h = h["hotel_get_response"]["hotel"];
                        var hid = h.hid;

                        h = (h.room_types ? (h.room_types["room_type"] || []) : []);
                        h.forEach(function(r, i) {r.hid = hid;});
                        data = data.concat(h);
                    }
                });
                if (data.length === 0) throw "NO_ROOM_TYPE " + params.name;

                var rooms = {};
                var rids = [];
                roomtypeids = result[1] || [];
                roomtypeids.forEach(function(r) {rooms[r.namechn] = r.roomtypeid;});
                data = data.filter(function(r) {
                    if (rooms[r.name]) {
                        r.roomtypeid = rooms[r.name];
                        return true;
                    }
                    return false;
                });
                rids = data.map(function(r) {return r.rid;});
                if (rids.length === 0) throw "NO_MATCHED " + params.name;

                return db("SELECT `rid` FROM `think_taobaoroom` WHERE `rid` IN (" + rids.join(",") + ")");
            }).then(function(result) { // think_taobaoroom
                var ids = result.map(function(r) {return r.rid;});
                var sqls = [];

                var values = data.map(function(r) {
                    var v = [];
                    v.push(r.rid);
                    v.push(r.hid);
                    v.push(r.roomtypeid);

                    if (ids.indexOf(r.rid) > -1) {
                        var qs = "UPDATE `think_taobaoroom` SET ";
                        var f = fields2.split(",");
                        v.forEach(function(value, index) {
                            if (index === 0) return null;
                            if (index > 1) qs += ",";
                            qs += f[index];
                            qs += "=";
                            qs += value;
                        });
                        qs += " WHERE `rid`=" + r.rid;
                        sqls.push(db(qs));
                    }
                    return v;
                });

                values = values.filter(function(r) {return ids.indexOf(r[0]) < 0;});
                inserted = values.map(function(r) {return r[0];});
                values = values.map(function(r) {return "(" + r.join(",") + ")";});
                if (values.length > 0)
                    sqls.push(db("INSERT INTO `think_taobaoroom` (" + fields2 + ") VALUES " + values.join(",")));
                return Promise.all(sqls);
            }).then(function(result) { // think_taobaoroom
                if (inserted.length > 0 && !result.pop()) console.log("ROOM_ERROR", inserted.join(","));
                total2 += data.length;

                var sqls = [];
                var rti = {};
                data.forEach(function(r) {rti[r.roomtypeid] = true;});
                roomtypeids.forEach(function(r) {
                    var qs = "UPDATE `think_room` SET ";
                    qs += "`status` = ";
                    qs += (rti[r.roomtypeid] ? 128 : 1);
                    qs += " WHERE `roomtypeid` = " + r.roomtypeid;
                    sqls.push(db(qs));
                });

                return Promise.all(sqls);
            })["catch"](function(e) {console.log(e);});
            promises.push(promise);
        }
    });

    Promise.all(promises).then(function(result) {
        var now = +(new Date());
        console.log("hotel matched:", total1, ",room matched:", total2, ",time:", now - start, "milliseconds");
        connection.end();
    });
})["catch"](function(e) {console.log(e);});
