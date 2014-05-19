var config = require("./auth.conf").mysql;
var jielvapi = require("./jielv-api.js");
var mysql = require('mysql');
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

var fields1 = "`hotelid`,`namechn`,`nameeng`,`country`,`state`,`city`,`website`,`original`";
var fields2 = "`roomtypeid`,`hotelid`,`namechn`,`original`";
var total1 = 0, total2 = 0;
var start = +(new Date());
var promises = [];
var hotelIds;
var i = 0, j;
for (; i < 1000; i += 1) {
    hotelIds = [];
    for (j = (i * 20 + 1); j <= ((i + 1) * 20); j += 1) hotelIds.push(j);
    hotelIds = hotelIds.join("/");

    (function(hids) {
        var data = [],
            inserted = [];
        var promise = jielvapi({
            "QueryType": "hotelinfo",
            "hotelIds": hids
        }).then(function(result) {
            if (result && result.success == 1) data = result.data;
            data = data.filter(function(h) {return h.active == 1;});
            total1 += data.length;

            var ids = data.map(function(h) {return h.hotelid;});
            ids = ids.filter(function(i) {return i !== "";});
            if (ids.length === 0) throw "No Hotel";
            return db("SELECT `hotelid` FROM `think_hotel` WHERE `hotelid` IN (" + ids.join(",") + ")");
        }).then(function(result) {
            var ids = result.map(function(h) {return h.hotelid;});
            var sqls = [];
            var values = data.map(function(h) {
                var v = [];
                var website = h.website.trim();
                if (website.length > 0 && !(/^http/.test(website))) website = "http://" + website;
                v.push(h.hotelid);
                v.push(JSON.stringify(h.namechn.trim()));
                v.push(JSON.stringify(h.nameeng.trim()));
                v.push(h.country);v.push(h.state);v.push(h.city);
                v.push(JSON.stringify(website));
                v.push(JSON.stringify(JSON.stringify(h)));

                if (ids.indexOf(h.hotelid) > -1) {
                    var qs = "UPDATE `think_hotel` SET ";
                    var f = fields1.split(",");
                    v.forEach(function(value, index) {
                        if (index === 0) return null;
                        if (index > 1) qs += ",";
                        qs += f[index];
                        qs += "=";
                        qs += value;
                    });
                    qs += " WHERE `hotelid`=" + h.hotelid;
                    sqls.push(db(qs));
                }
                return v;
            });
            values = values.filter(function(h) {return ids.indexOf(h[0]) < 0;});
            inserted = values.map(function(h) {return h[0];});
            values = values.map(function(h) {return "(" + h.join(",") + ")";});
            if (values.length > 0)
                sqls.push(db("INSERT INTO `think_hotel` (" + fields1 + ") VALUES " + values.join(",")));
            return Promise.all(sqls);
        }).then(function(result) {
            if (inserted.length > 0 && !result.pop()) console.log("HOTEL_ERROR", inserted.join(","));

            var ids = data.map(function(h) {
                var rids = h.rooms.map(function(r) {return r.roomtypeid;});
                total2 += h.rooms.length;
                return rids.join(',');
            });
            ids = ids.filter(function(i) {return i !== "";});
            if (ids.length === 0) throw "No Room";
            return db("SELECT `roomtypeid` FROM `think_room` WHERE `roomtypeid` IN (" + ids.join(",") + ")");
        }).then(function(result) {
            var ids = result.map(function(r) {return r.roomtypeid;});
            var sqls = [];
            var values = [];
            data.forEach(function(h) {
                h.rooms.forEach(function(r) {
                    var v = [];
                    v.push(r.roomtypeid);
                    v.push(h.hotelid);
                    v.push(JSON.stringify(r.namechn.trim()));
                    v.push(JSON.stringify(JSON.stringify(r)));
                    values.push(v);
                    if (ids.indexOf(r.roomtypeid) > -1) {
                        var qs = "UPDATE `think_room` SET ";
                        var f = fields2.split(",");
                        v.forEach(function(value, index) {
                            if (index === 0) return null;
                            if (index > 1) qs += ",";
                            qs += f[index];
                            qs += "=";
                            qs += value;
                        });
                        qs += " WHERE `roomtypeid`=" + r.roomtypeid;
                        sqls.push(db(qs));
                    }
                });
            });
            values = values.filter(function(r) {return ids.indexOf(r[0]) < 0;});
            inserted = values.map(function(r) {return r[0];});
            values = values.map(function(r) {return "(" + r.join(",") + ")";});
            if (values.length > 0)
                sqls.push(db("INSERT INTO `think_room` (" + fields2 + ") VALUES " + values.join(",")));
            return Promise.all(sqls);
        }).then(function(result) {
            if (inserted.length > 0 && !result.pop()) console.log("ROOM_ERROR", inserted.join(","));
            console.log(hids);
        })["catch"](function(e) {console.log(e);});
        promises.push(promise);
    })(hotelIds);
}

Promise.all(promises).then(function(result) {
    var now = +(new Date());
    console.log("hotel total:", total1, "room total:", total2, ",time:", now - start, "milliseconds");
    connection.end();
});
