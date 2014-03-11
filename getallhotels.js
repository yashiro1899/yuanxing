var jielvapi = require("./jielv-api.js");
var Promise = require('es6-promise').Promise;
var mysql = require('mysql');
var config = require("./auth.conf").mysql;

var select = function(id) {
    return new Promise(function(resolve, reject) {
        var connection = mysql.createConnection(config);
        var querystring = "SELECT `namechn` FROM `think_hotel` WHERE `hotelid` = " + id;

        connection.connect();
        connection.query(querystring, function(err, rows, fields) {
            if (!err && rows.length > 0) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
        connection.end();
    });
};
var insert = function(values) {
    return new Promise(function(resolve, reject) {
        var connection = mysql.createConnection(config);
        var querystring = "INSERT INTO `think_hotel` VALUES (" + values.join(',') + ")";

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
console.log("total:", total, ", time:", + (new Date()));
data.reduce(function(sequence, ids) {
    return sequence.then(function() {
        return jielvapi({
            "QueryType": "hotelinfo",
            "hotelIds": ids
        });
    }).then(function(result) {
        if (!result) return false;

        total += result.data.length;
        console.log("total:", total, ",time:", + (new Date()));
        result.data.reduce(function(s, h) {
            return s.then(function() {
                return select(h.hotelid);
            }).then(function(exists) {
                if (exists) {
                    console.log(h.hotelid, "exists");
                    return Promise.resolve(null);
                } else {
                    var values = [];
                    values.push(h.hotelid);
                    values.push(JSON.stringify(h.hotelcd));
                    values.push(JSON.stringify(h.namechn));
                    values.push(JSON.stringify(h.nameeng));
                    values.push(h.country);
                    values.push(h.state);
                    values.push(h.city);
                    values.push(JSON.stringify(h.website));
                    values.push(0);
                    return select(values.join(","));
                }
            }).then(function(success) {
                if (success !== null) console.log(h.hotelid, success ? "success" : "error");
            });
        }, Promise.resolve());
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
