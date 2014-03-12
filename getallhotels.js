var config = require("./auth.conf").mysql;
var jielvapi = require("./jielv-api.js");
var mysql = require('mysql');
var Promise = require('es6-promise').Promise;

var select = function(ids) {
    return new Promise(function(resolve, reject) {
        var connection = mysql.createConnection(config);
        var querystring = "SELECT `hotelid` FROM `think_hotel` WHERE `hotelid` IN (" + ids + ")";

        connection.connect();
        connection.query(querystring, function(err, rows, fields) {
            if (err) rows = [];
            resolve(rows);
        });
        connection.end();
    });
};
var insert = function(values) {
    return new Promise(function(resolve, reject) {
        var connection = mysql.createConnection(config);
        var querystring = "INSERT INTO `think_hotel` VALUES " + values;

        connection.connect();
        connection.query(querystring, function(err, rows, fields) {
            if (err) {
                resolve(false);
            } else {
                resolve(true);
            }
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

var total = 0;
var start = +(new Date());
data.reduce(function(sequence, ids) {
    var values = [];

    return sequence.then(function() {
        return jielvapi({
            "QueryType": "hotelinfo",
            "hotelIds": ids
        });
    }).then(function(result) {
        if (!result) {
            result = {
                data: []
            };
        }

        total += result.data.length;
        result.data.forEach(function(h) {
            var v = [];
            v.push(h.hotelid);
            v.push(JSON.stringify(h.hotelcd));
            v.push(JSON.stringify(h.namechn));
            v.push(JSON.stringify(h.nameeng));
            v.push(h.country);
            v.push(h.state);
            v.push(h.city);
            v.push(JSON.stringify(h.website));
            v.push(0);
            values.push(v);
        });
        var ids = values.map(function(h) {
            return h[0];
        });
        return select(ids.join(","));
    }).then(function(result) {
        result = result.map(function(h) {
            return h.hotelid;
        });
        values = values.filter(function(h) {
            return result.indexOf(h[0]) == -1;
        });
        return insert(values.map(function(h) {
            return "(" + h.join(",") + ")";
        }).join(','));
    }).then(function(result) {
        values.forEach(function(h) {
            console.log(h[0], "error");
        });

        var now = +(new Date());
        console.log("total:", total, ",time:", now - start, "milliseconds");
    });
}, Promise.resolve());
//
//5
//down vote
//You can use SQL_CALC_FOUND_ROWS like this
//
//SELECT SQL_CALC_FOUND_ROWS * FROM users limit 0,5;
//It gets the row count before applying any LIMIT clause. It does need another query to fetch the results but that query can simply be
//
//SELECT FOUND_ROWS()
//and hence you don't have to repeat your complicated query.'
