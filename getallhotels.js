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
        var querystring = "SELECT `hotelid` FROM `think_hotel` WHERE `hotelid` IN (" + ids + ")";
        return db(querystring, "select");
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

        var querystring = "INSERT INTO `think_hotel` VALUES " + values.join(",");
        return db(querystring, "insert");
    }).then(function(result) {
        console.log(result);
        // if (!result) {
        //     values.forEach(function(h) {
        //         console.log(h[0], "error");
        //     });
        // }

        // var now = +(new Date());
        // console.log("total:", total, ",time:", now - start, "milliseconds");
    });
}, Promise.resolve());
