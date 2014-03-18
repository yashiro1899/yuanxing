var config = require("./auth.conf").mysql;
var jielvapi = require("./jielv-api.js");
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

var data = [];
var i = 0, j, hotelIds;
for (; i < 505; i += 1) {
    hotelIds = [];
    for (j = (i * 20 + 1); j <= ((i + 1) * 20); j += 1) hotelIds.push(j);
    hotelIds = hotelIds.join("/");
    data.push(hotelIds);
}

var total1 = 0;
var total2 = 0;
var start = +(new Date());
data.reduce(function(sequence, ids) {
    var data = [];

    return sequence.then(function() {
        return jielvapi({
            "QueryType": "hotelinfo",
            "hotelIds": ids
        });
    }).then(function(result) {
        if (result && result.success == 1) data = result.data;
        total1 += data.length;
        var ids = data.map(function(h) {return h.hotelid;});
        return db("SELECT `hotelid` FROM `think_hotel` WHERE `hotelid` IN (" + ids + ")");
    }).then(function(result) {
        var ids = result.map(function(h) {return h.hotelid;});
        var values = data.map(function(h) {
            var v = [];
            var website = h.website.trim();
            if (website.length > 0 && !(/^http/.test(website))) website = "http://" + website;
            v.push(h.hotelid);
            v.push(JSON.stringify(h.hotelcd));
            v.push(JSON.stringify(h.namechn));
            v.push(JSON.stringify(h.nameeng));
            v.push(h.country);v.push(h.state);v.push(h.city);
            v.push(JSON.stringify(website));
            v.push(0);
            return v;
        });
        values = values.filter(function(h) {return ids.indexOf(h[0]) == -1;});
        values = values.map(function(h) {return "(" + h.join(",") + ")";});

        var fields = " (`hotelid`,`hotelcd`,`namechn`,`nameeng`,`country`,`state`,`city`,`website`,`taobao_hid`)";
        return db("INSERT INTO `think_hotel`" + fields + " VALUES " + values.join(","));
    }).then(function(result) {
        var ids = data.map(function(h) {return h.hotelid;});
        if (result.length) console.log("HOTEL_ERROR", ids.join(","));

        ids = data.map(function(h) {
            var rids = h.rooms.map(function(r) {return r.roomtypeid;});
            total2 += h.rooms.length;
            return rids.join(',');
        });
        return db("SELECT `roomtypeid` FROM `think_room` WHERE `roomtypeid` IN (" + ids.join(",") + ")");
    }).then(function(result) {
        var ids = result.map(function(r) {return r.roomtypeid;});
        var values = [];
        data.forEach(function(h) {
            h.rooms.forEach(function(r) {
                var v = [];
                v.push(r.roomtypeid);
                v.push(h.hotelid);
                v.push(JSON.stringify(r.namechn));
                v.push(0);v.push(0);
                values.push(v);
            });
        });
        values = values.map(function(h) {return "(" + h.join(",") + ")";});

        var fields = " (`roomtypeid`,`hotelid`,`namechn`,`status`,`taobao_rid`)";
        return db("INSERT INTO `think_room`" + fields + " VALUES " + values.join(","));
    }).then(function(result) {
        var ids = data.map(function(h) {return h.hotelid;});
        if (result.length) console.log("ROOM_ERROR", ids.join(","));
        var now = +(new Date());
        console.log("hotel total:", total1, "room total:", total2, ",time:", now - start, "milliseconds");
    }).catch(function(e) {
        console.log(e);
    });
}, Promise.resolve());
