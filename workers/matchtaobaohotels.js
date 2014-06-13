var config = require("../auth.conf").mysql;
var mapping = require("../define.conf");
var mysql = require('mysql');
var oauth = require("../taobao-oauth.js");
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

var token = db('SELECT `nick`,`token`,`expires` FROM `think_user` WHERE `nick` = "liwenmz"');
var hotels = db('SELECT `hotelid`,`namechn`,`nameeng`,`country`,`state` FROM `think_hotel`');
Promise.all(token, hotels).then(function(result) {
    token = result[0]["token"];
    hotels = result[1];
    console.log(token);
});
// select nick , token , expires from think_user where nick = "liwenmz";
// var fields1 = "`hid`,`hotelid`,`original`";
// var fields2 = "`rid`,`hid`,`roomtypeid`";
// var qs = "";
// db(qs).then(function(hotels) {
//     var total1 = 0, total2 = 0;
//     var start = +(new Date());
//     var pieces = [];

//     var block = 800;
//     var length = Math.ceil(hotels.length / block);
//     var i = 0;
//     for (; i < length; i += 1) {
//         pieces.push(hotels.slice(i * block, (i + 1) * block));
//     }

//     var last = pieces.length - 1;
//     last = pieces[last];
//     pieces.reduce(function(sequence, p) {
//         return sequence.then(function() {
//             var promises = [];
//             p.forEach(function(hotel) {
//                 var params = {
//                     "method": "taobao.hotels.search",
//                     "name": hotel.namechn
//                 };
//                 var state = mapping.province[hotel.state],
//                     country = mapping.country[hotel.country];

//                 if (state) {
//                     params["domestic"] = true;
//                     params["province"] = state[1];
//                     if (params.name) promises.push(generate(params, hotel));
//                 } else if (country) {
//                     params["domestic"] = false;
//                     params["country"] = country[1];
//                     if (params.name) promises.push(generate(params, hotel));

//                     var another = {};
//                     Object.keys(params).forEach(function(k) {return another[k] = params[k];});
//                     another["name"] = hotel.nameeng;
//                     if (params.name) promises.push(generate(params, hotel));
//                 }
//             });
//             return Promise.all(promises);
//         }).then(function() {
//             var now = +(new Date());
//             console.log("hotel matched:", total1, ",room matched:", total2, ",time:", now - start, "milliseconds");
//             if (last === p) connection.end();
//         })["catch"](function(e) {console.log(e);});
//     }, Promise.resolve());

//     function generate(params, hotel) {
//         var data = [],
//             inserted = [],
//             roomtypeids = [];
//         var promise = oauth.accessProtectedResource(null, null, params, token);
//         return promise.then(function(result) { // taobao.hotels.search
//             if (!result) throw "NO_MATCHED " + params.name;

//             result = result["hotels_search_response"];
//             if (!result) throw "NO_MATCHED " + params.name;

//             var total = result["total_results"];
//             result = result["hotels"];
//             if (!result) throw "NO_MATCHED " + params.name;

//             result = result["hotel"] || [];
//             if (total > 20) console.log("GREATER THAN 20,", total, params.name);

//             var hids = [];
//             result.forEach(function(h) {
//                 if (params.name == h.name) hids.push(h.hid);
//             });
//             if (hids.length === 0) throw "NO_MATCHED " + params.name;
//             data = result.filter(function(h) {return hids.indexOf(h.hid) > -1;});
//             return db("SELECT `hid` FROM `think_taobaohotel` WHERE `hid` in (" + hids.join(',') + ")");
//         }).then(function(result) { // think_taobaohotel
//             var ids = result.map(function(h) {return h.hid;});
//             var sqls = [];
//             var values = data.map(function(h) {
//                 var v = [];
//                 v.push(h.hid);
//                 v.push(hotel.hotelid);
//                 v.push(JSON.stringify(JSON.stringify(h)));

//                 if (ids.indexOf(h.hid) > -1) {
//                     var qs = "UPDATE `think_taobaohotel` SET ";
//                     var f = fields1.split(",");
//                     v.forEach(function(value, index) {
//                         if (index === 0) return null;
//                         if (index > 1) qs += ",";
//                         qs += f[index];
//                         qs += "=";
//                         qs += value;
//                     });
//                     qs += " WHERE `hid`=" + h.hid;
//                     sqls.push(db(qs));
//                 }
//                 return v;
//             });

//             values = values.filter(function(h) {return ids.indexOf(h[0]) < 0;});
//             inserted = values.map(function(h) {return h[0];});
//             values = values.map(function(h) {return "(" + h.join(",") + ")";});
//             if (values.length > 0)
//                 sqls.push(db("INSERT INTO `think_taobaohotel` (" + fields1 + ") VALUES " + values.join(",")));
//             return Promise.all(sqls);
//         }).then(function(result) { // think_taobaohotel
//             if (inserted.length > 0 && !result.pop()) console.log("HOTEL_ERROR", inserted.join(","));

//             total1 += data.length;
//             var promises = [];
//             var model;

//             data.forEach(function(h) {
//                 promises.push(oauth.accessProtectedResource(null, null, {
//                     "hid": h.hid,
//                     "method": "taobao.hotel.get",
//                     "need_room_type": true
//                 }, token));
//             });
//             model = db("SELECT `roomtypeid`,`namechn` FROM `think_room` WHERE `hotelid` = " + hotel.hotelid);
//             return Promise.all([Promise.all(promises), model]);
//         }).then(function(result) { // taobao.hotel.get, think_room
//             data = [];
//             result[0].forEach(function(h) {
//                 if (h && h["hotel_get_response"]) {
//                     h = h["hotel_get_response"]["hotel"];
//                     var hid = h.hid;

//                     h = (h.room_types ? (h.room_types["room_type"] || []) : []);
//                     h.forEach(function(r, i) {r.hid = hid;});
//                     data = data.concat(h);
//                 }
//             });
//             if (data.length === 0) throw "NO_ROOM_TYPE " + params.name;

//             var rooms = {};
//             var rids = [];
//             roomtypeids = result[1] || [];
//             roomtypeids.forEach(function(r) {rooms[r.namechn] = r.roomtypeid;});
//             data = data.filter(function(r) {
//                 if (rooms[r.name]) {
//                     r.roomtypeid = rooms[r.name];
//                     return true;
//                 }
//                 return false;
//             });
//             rids = data.map(function(r) {return r.rid;});
//             if (rids.length === 0) throw "NO_MATCHED " + params.name;

//             return db("SELECT `rid` FROM `think_taobaoroom` WHERE `rid` IN (" + rids.join(",") + ")");
//         }).then(function(result) { // think_taobaoroom
//             var ids = result.map(function(r) {return r.rid;});
//             var sqls = [];

//             var values = data.map(function(r) {
//                 var v = [];
//                 v.push(r.rid);
//                 v.push(r.hid);
//                 v.push(r.roomtypeid);

//                 if (ids.indexOf(r.rid) > -1) {
//                     var qs = "UPDATE `think_taobaoroom` SET ";
//                     var f = fields2.split(",");
//                     v.forEach(function(value, index) {
//                         if (index === 0) return null;
//                         if (index > 1) qs += ",";
//                         qs += f[index];
//                         qs += "=";
//                         qs += value;
//                     });
//                     qs += " WHERE `rid`=" + r.rid;
//                     sqls.push(db(qs));
//                 }
//                 return v;
//             });

//             values = values.filter(function(r) {return ids.indexOf(r[0]) < 0;});
//             inserted = values.map(function(r) {return r[0];});
//             values = values.map(function(r) {return "(" + r.join(",") + ")";});
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
//         })["catch"](function(e) {console.log(e);});
//     }
// })["catch"](function(e) {console.log(e);});
