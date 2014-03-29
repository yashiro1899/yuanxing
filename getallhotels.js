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

var fields = "`hotelid`,`hotelcd`,`namechn`,`nameeng`,`country`,`state`,`city`,`website`,`original`";
var total1 = 0, total2 = 0;
var start = +(new Date());
var promises = [];
var hotelIds, promise, data;
var i = 0, j;
for (; i < 5; i += 1) {
    hotelIds = [];
    for (j = (i * 20 + 1); j <= ((i + 1) * 20); j += 1) hotelIds.push(j);
    hotelIds = hotelIds.join("/");

    data = [];
    promise = jielvapi({
        "QueryType": "hotelinfo",
        "hotelIds": hotelIds
    }).then(function(result) {
        if (result && result.success == 1) data = result.data;
        total1 += data.length;
        var ids = data.map(function(h) {return h.hotelid;});
        return db("SELECT `hotelid` FROM `think_hotel` WHERE `hotelid` IN (" + ids + ")");
    }).then(function(result) {
        var ids = result.map(function(h) {return h.hotelid;});
        var sqls = [];
        var values = data.map(function(h) {
            var v = [];
            var website = h.website.trim();
            if (website.length > 0 && !(/^http/.test(website))) website = "http://" + website;
            v.push(h.hotelid);
            v.push(JSON.stringify(h.hotelcd));
            v.push(JSON.stringify(h.namechn.trim()));
            v.push(JSON.stringify(h.nameeng.trim()));
            v.push(h.country);v.push(h.state);v.push(h.city);
            v.push(JSON.stringify(website));
            v.push(JSON.stringify(JSON.stringify(h)));

            if (ids.indexOf(h[0]) > -1) {
                var qs = "UPDATE `think_hotel` SET ";
                var f = fields.split(",");
                v.forEach(function(value, index) {
                    if (index !== 0) qs += ",";
                    qs += f[index];
                    qs += "=";
                    qs += value;
                });
                qs += " WHERE `hotelid`=" + h.hotelid;
                sqls.push(db(qs));
            }
            return v;
        });
        values = values.filter(function(h) {return ids.indexOf(h[0]) == -1;});
        values = values.map(function(h) {return "(" + h.join(",") + ")";});
        if (values.length > 0)
            sqls.push(db("INSERT INTO `think_hotel` (" + fields + ") VALUES " + values.join(",")));
        return Promise.all(sqls);
    })["catch"](function(e) {console.log(e);});
    promises.push(promise);
}

Promise.all(promises).then(function(result) {
    console.log(result);
    connection.end();
});
//         inserted = values;

//     }).then(function(result) {
//         if (!result && inserted.length > 0) {
//             inserted.forEach(function(h) {
//                 console.log("HOTEL_ERROR", h[0]);
//             });
//         }

//         var ids = data.map(function(h) {
//             var rids = h.rooms.map(function(r) {return r.roomtypeid;});
//             total2 += h.rooms.length;
//             return rids.join(',');
//         });
//         return db("SELECT `roomtypeid` FROM `think_room` WHERE `roomtypeid` IN (" + ids.join(",") + ")");
//     }).then(function(result) {
//         var ids = result.map(function(r) {return r.roomtypeid;});
//         var values = [];
//         data.forEach(function(h) {
//             h.rooms.forEach(function(r) {
//                 var v = [];
//                 v.push(r.roomtypeid);
//                 v.push(h.hotelid);
//                 v.push(JSON.stringify(r.namechn));
//                 v.push(JSON.stringify(r.bedtype));
//                 v.push(0);v.push(0);
//                 values.push(v);
//             });
//         });
//         values = values.filter(function(r) {return ids.indexOf(r[0]) == -1;});
//         inserted = values;
//         values = values.map(function(r) {return "(" + r.join(",") + ")";});

//         var fields = " (`roomtypeid`,`hotelid`,`namechn`,`bedtype`,`status`,`taobao_rid`)";
//         return db("INSERT INTO `think_room`" + fields + " VALUES " + values.join(","));
//     }).then(function(result) {
//         if (!result && inserted.length > 0) {
//             inserted.forEach(function(r) {
//                 console.log("ROOM_ERROR", r[0]);
//             });
//         }

//         var now = +(new Date());
//         console.log("hotel total:", total1, "room total:", total2, ",time:", now - start, "milliseconds");
// }, Promise.resolve());
