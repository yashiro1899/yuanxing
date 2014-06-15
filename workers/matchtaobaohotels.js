var config = require("../auth.conf").mysql;
var mapping = require("../define.conf");
var mysql = require('mysql');
var oauth = require("../taobao-oauth.js");
var Promise = require('es6-promise').Promise;

var getDefer = function() {
    var deferred = {};
    deferred.promise = new Promise(function(resolve, reject) {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });
    return deferred;
};

var connection = mysql.createConnection(config);
var db = function(querystring) {
    var dfd = getDefer();
    connection.query(querystring, function(err, rows, fields) {
        if (/^SELECT/.test(querystring)) {
            if (err) {
                console.log(err.toString());
                rows = [];
            }
            dfd.resolve(rows);
        } else {
            if (err) {
                console.log(err.toString());
                dfd.resolve(false);
            } else {
                dfd.resolve(true);
            }
        }
    });
    return dfd.promise;
};
connection.connect();

var token = db('SELECT `token` FROM `think_user` WHERE `nick` = "liwenmz"');
var hotels = db('SELECT `hotelid`,`namechn`,`nameeng`,`country`,`state` FROM `think_hotel` LIMIT 20');
Promise.all([token, hotels]).then(function(result) {
    token = result[0][0]["token"];
    hotels = result[1];

    var total1 = 0, total2 = 0;
    var start = Date.now();
    var params = [];
    var i = 0,
        length = hotels.length;
    var hotel, state, country;
    for (; i < length; i += 1) {
        hotel = hotels[i];
        state = mapping.province[hotel.state];
        country = mapping.country[hotel.country];

        if (state) {
            params.push({
                domestic: true,
                province: state[1],
                name: hotel.namechn,
                hotelid: hotel.hotelid
            });
        } else if (country) {
            if (hotel.nameeng.trim() === "") continue;
            params.push({
                domestic: false,
                country: country[1],
                name: hotel.namechn,
                hotelid: hotel.hotelid
            });
            params.push({
                domestic: false,
                country: country[1],
                name: hotel.nameeng,
                hotelid: hotel.hotelid
            });
        }
    }
    hotels = null;

    var pieces = [];
    var block = Math.ceil(params.length / 5);
    for (i = 0; i < 5; i += 1) {
        pieces.push(params.slice(i * block, (i + 1) * block));
    }
    params = null;

    var promises = [];
    pieces.forEach(function(thread) {
        promises.push(thread.reduce(function(sequence, param) {
            var taobao;
            var hotelid = param.hotelid;
            delete param.hotelid;
            return sequence.then(function(result) {
                param.method = "taobao.hotels.search";
                return oauth.accessProtectedResource(null, null, param, token);
            }).then(function(result) { // taobao.hotels.search
                if (result && (result = result["hotels_search_response"])) {
                    if (result["total_results"] > 20) console.log("GREATER THAN 20,", total, params.name);
                    if ((result = result.hotels) && result.hotel) {
                        taobao = result.hotel.filter(function(h) {return (param.name == h.name);});
                        if (taobao.length === 0) throw "NO_MATCHED";

                        var hids = taobao.map(function(h) {return h.hid;});
                        return db("SELECT `hid` FROM `think_taobaohotel` WHERE `hid` in (" + hids.join(',') + ")");
                    }
                    throw "NO_MATCHED";
                }
                throw "NO_MATCHED";
            }).then(function(result) { // think_taobaohotel
                var ids = result.map(function(h) {return h.hid;});
                var updatings = [];
                var insertings = [];
                taobao.forEach(function(h) {
                    var qs;
                    if (ids.indexOf(h.hid) > -1) {
                        qs = "`original` = " + JSON.stringify(JSON.stringify(h)) + " WHERE `hid` = " + h.hid;
                        updatings.push(qs);
                    } else {
                        qs = [];
                        qs.push(h.hid);
                        qs.push(hotelid);
                        qs.push(JSON.stringify(JSON.stringify(h)));
                        qs = "(" + qs.join(",") + ")";
                        insertings.push(qs);
                    }
                });

                updatings = updatings.map(function(qs) {return db("UPDATE `think_taobaohotel` SET " + qs);});
                if (insertings.length > 0)
                    updatings.push(db("INSERT INTO `think_taobaohotel` (hid,hotelid,original) VALUES " + insertings.join(",")));
                return Promise.all(updatings);
            }).then(function(result) { // think_taobaohotel
                var success = true;
                result.forEach(function(r) {if (r === false) success = r;});
                if (success === false) console.log(taobao.map(function(h) {return h.hid;}).join(","));
                else total1 += taobao.length;

                return db("SELECT `roomtypeid`,`namechn` FROM `think_room` WHERE `hotelid` = " + hotelid);
            }).then(function(result) { // think_room
                var names = {};
                result.forEach(function(r) {names[r.namechn] = r.roomtypeid;});
                var rooms = [];
                return taobao.map(function(h) {return h.hid;}).reduce(function(sequence, hid) {
                    return sequence.then(function(result) {
                        return oauth.accessProtectedResource(null, null, {
                            "hid": hid,
                            "method": "taobao.hotel.get",
                            "need_room_type": true
                        }, token);
                    }).then(function(result) {
                        if (result && (result = result["hotel_get_response"]) && (result = result.hotel) && (result = result.room_types) && result.room_type) {
                            result.room_type.forEach(function(room) {
                                var roomtypeid = names[room.name];
                                if (roomtypeid) {
                                    rooms.push({
                                        rid: room.rid,
                                        hid: room.hid,
                                        roomtypeid: roomtypeid
                                    });
                                }
                            });
                        }
                        return rooms;
                    });
                }, Promise.resolve());
            }).then(function(result) { // taobao.hotel.get
                taobao = result;
                if (taobao.length === 0) throw "NO_MATCHED";

                var rids = taobao.map(function(r) {return r.rid;});
                return db("SELECT `rid` FROM `think_taobaoroom` WHERE `rid` IN (" + rids.join(",") + ")");
            }).then(function(result) { // think_taobaoroom
                var ids = result.map(function(r) {return r.rid;});
                var insertings = [];
                taobao.forEach(function(r) {
                    var qs = [];
                    if (ids.indexOf(r.rid) < 0) {
                        qs.push(r.rid);
                        qs.push(r.hid);
                        qs.push(r.roomtypeid);
                        qs = "(" + qs.join(",") + ")";
                        insertings.push(qs);
                    }
                });
                console.log(insertings);
            })["catch"](function(e) {console.log(e);});
        }, Promise.resolve()));
    });
    Promise.all(promises).then(function(result) {
        console.log((Date.now() - start) + "", "milliseconds");
        connection.end();
    });
});

//             if (values.length > 0)
//                 sqls.push(db("INSERT INTO `think_taobaoroom` (" + fields2 + ") VALUES " + values.join(",")));
//             return Promise.all(sqls);
//         }).then(function(result) { // think_taobaoroom
//             if (inserted.length > 0 && !result.pop()) console.log("ROOM_ERROR", inserted.join(","));
//             total2 += data.length;

//             var sqls = [];
//             var rti = {};
//             data.forEach(function(r) {rti[r.roomtypeid] = true;});
//             roomtypeids.forEach(function(r) {
//                 var qs = "UPDATE `think_room` SET ";
//                 qs += "`status` = ";
//                 qs += (rti[r.roomtypeid] ? 128 : 1);
//                 qs += " WHERE `roomtypeid` = " + r.roomtypeid;
//                 sqls.push(db(qs));
//             });

//             return Promise.all(sqls);
//         }).then(function(result) { // think_taobaoroom
//             console.log(params.name, result.length, "roomtypeids");
//     }
// })["catch"](function(e) {console.log(e);});
