var jielvapi = require("./jielv-api.js");
var Promise = require('es6-promise').Promise;
var mysql = require('mysql');
var config = require("./auth.conf").mysql;

var insert = function(values) {
    return new Promise(function(resolve, reject) {
        var connection = mysql.createConnection(config);
        var querystring = 'INSERT INTO `think_hotel` VALUES (' + values + ')';
        connection.connect();
        connection.query(querystring, function(err, rows, fields) {
            if (err) resolve(null);

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

data.reduce(function(sequence, ids) {
    return sequence.then(function() {
        return jielvapi({
            "QueryType": "hotelinfo",
            "hotelIds": ids
        });
    }).then(function(result) {
        if (!result) return false;

        console.log(result.data.length);
        result.data.reduce(function(s, h) {
            return s.then(function() {
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

                return insert(values.join(","));
            }).then(function(result) {
                if (!result) return false;
                console.log(h.hotelid, h.namechn);
            });
        }, Promise.resolve());
    });
}, Promise.resolve());
