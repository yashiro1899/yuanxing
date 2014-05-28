/**
 * controller
 * @return
 */
var cookie = require("cookie");
var dateformat = require("dateformat");
var jielvapi = require("../../../../jielv-api.js");
var oauth = require("../../../../taobao-oauth");
var querystring = require('querystring');
function rot13(s) {
    var i;
    var rotated = '';
    s = s || "";
    for (i = 0; i < s.length; i++) {
        var ch = s.charCodeAt(i);
        // a-z -> n-m
        if (97 <= ch && ch <= 122) {
            rotated += String.fromCharCode((ch - 97 + 13) % 26 + 97);
            // A-Z -> N-M
        } else if (65 <= ch && ch <= 90) {
            rotated += String.fromCharCode((ch - 65 + 13) % 26 + 65);
        } else {
            rotated += s[i];
        }
    }
    return rotated;
}
function prices(roomtypeids) {
    var promises = [];
    var length = Math.ceil(roomtypeids.length / 20);
    var i = 0;

    for (; i < length; i += 1) {
        var start = Date.now();
        var end = start + 30 * 24 * 60 * 60 * 1000;

        for (var j = 0; j < 3; j += 1) {
            promises.push(jielvapi({
                "QueryType": "hotelpriceall",
                "roomtypeids": roomtypeids.slice(i * 20, (i + 1) * 20).join("/"),
                "checkInDate": dateformat(start, "yyyy-mm-dd"),
                "checkOutDate": dateformat(end, "yyyy-mm-dd")
            }));

            start = end;
            end = start + 30 * 24 * 60 * 60 * 1000;
        }
    }
    return promises;
}
function prices2(roomtypeids) {
    var parameters = [];
    var length = Math.ceil(roomtypeids.length / 20);
    var i = 0;

    for (; i < length; i += 1) {
        var start = Date.now();
        var end = start + 30 * 24 * 60 * 60 * 1000;

        for (var j = 0; j < 3; j += 1) {
            parameters.push({
                "QueryType": "hotelpriceall",
                "roomtypeids": roomtypeids.slice(i * 20, (i + 1) * 20).join("/"),
                "checkInDate": dateformat(start, "yyyy-mm-dd"),
                "checkOutDate": dateformat(end, "yyyy-mm-dd")
            });

            start = end;
            end = start + 30 * 24 * 60 * 60 * 1000;
        }
    }

    var pieces = [];
    var block = 500;
    length = Math.ceil(parameters.length / block);
    for (i = 0; i < length; i += 1) {
        pieces.push(parameters.slice(i * block, (i + 1) * block));
    }

    return pieces.reduce(function(sequence, p) {
        var data;
        return sequence.then(function(result) {
            data = result;
            return Promise.all(p.map(function(param) {return jielvapi(param);}));
        }).then(function(result) {
            var rooms = [];
            var i = 0,
                len = result.length;
            var cluster;

            var j, clen, room;

            var k, rlen, rpd, rpds;
            for (; i < len; i += 1) {
                cluster = result[i];
                if (cluster && cluster.data && cluster.data.length) {
                    clen = cluster.data.length;
                    for (j = 0; j < clen; j += 1) {
                        room = cluster.data[j];
                        rlen = room.roomPriceDetail.length;
                        rpds = [];
                        for (k = 0; k < rlen; k += 1) {
                            rpd = room.roomPriceDetail[k];
                            if (rpd.qtyable < 1) continue;
                            rpds.push([rpd.ratetype, rpd.night, rpd.preeprice, rpd.qtyable]);
                        }
                        rpds.roomtypeid = room.roomtypeId;
                        rooms.push(rpds);
                    }
                }
            }
            return data.concat(rooms);
        });
    }, Promise.resolve([]));
}
module.exports = Controller(function() {
    return {
        cookieAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            var now = +(new Date());
            var data = {
                "taobao_user_id": 0,
                "taobao_user_nick": "",
                "access_token": ""
            };

            var token = this.get("token");
            if (token) {
                data["taobao_user_id"] = token.slice(47);
                data["taobao_user_nick"] = token.slice(47);
                data["access_token"] = token;
            }

            data = querystring.stringify(data);
            data = rot13(data);
            data = cookie.serialize("access_token.taobao", data, {
                path: "/",
                expires: (new Date(90 * 24 * 60 * 60 * 1000 + now))
            });

            res.setHeader("Set-Cookie", data);
            this.end("haha");
        },
        callbackAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            this.end({
                "Usercd": "SZ2747",
                "Authno": "123456",
                "msg": "成功"
            });

            var data = Object.keys(this.http.post || {})[0];
            if (!data) return null;

            try {
                data = JSON.parse(data);
                var roomtypeids = data.roomtypeids.replace(/\/$/, "").split('/');
                if (roomtypeids.length === 0) return null;

                var time = dateformat(new Date(), "[yyyy-mm-dd HH:MM:ss]");
                console.log(time, "jielv.callback", roomtypeids.length, "roomtypeids");

                var users = {};
                var model = D("Goods").where("roomtypeid in (" + roomtypeids.join(",") + ") and status = 4");
                model.select().then(function(result) { // think_goods
                    result = result || [];
                    if (result.length === 0) return getDefer().promise;

                    roomtypeids = {};
                    result.forEach(function(g) {
                        roomtypeids[g.roomtypeid] = true;

                        if (!users[g.userid]) users[g.userid] = [];
                        users[g.userid].push(g);
                    });

                    var promises = [];
                    promises.push(D("User").field("id,token,expires").where("id in (" + Object.keys(users).join(",") + ")").select());
                    promises = promises.concat(prices(Object.keys(roomtypeids)));
                    return Promise.all(promises);
                }).then(function(result) { // hotelpriceall, think_user
                    var data = [];
                    result.slice(1).forEach(function(p) {
                        if (p && p.data.length) data.push(p.data);
                    });
                    if (data.length === 0) return getDefer().promise;

                    roomtypeids = {};
                    data.forEach(function(period) {
                        period.forEach(function(r) {
                            if (!roomtypeids[r.roomtypeId]) roomtypeids[r.roomtypeId] = {};
                            r.roomPriceDetail.forEach(function(rpd) {
                                if (!roomtypeids[r.roomtypeId][rpd.ratetype]) roomtypeids[r.roomtypeId][rpd.ratetype] = {};

                                var night = dateformat((new Date(rpd.night)), "yyyy-mm-dd");
                                var num = (rpd.qtyable > 0 ? rpd.qtyable : 0);
                                if (num < 1) return null;
                                roomtypeids[r.roomtypeId][rpd.ratetype][night] = rpd;
                            });
                        });
                    });

                    data = result[0] || [];
                    if (data.length === 0) return getDefer().promise;

                    data.forEach(function(u) {
                        if (!users[u.id]) return null;
                        users[u.id]["token"] = u.token;
                        users[u.id]["expires"] = u.expires;
                    });

                    var i, u, temp;
                    var promises = [];
                    for (i in users) {
                        u = users[i];
                        if (u.expires < Date.now()) continue;

                        temp = [];
                        u.forEach(function(g) {
                            temp.push(g.gid);
                            if (temp.length == 20) {
                                promises.push(oauth.accessProtectedResource(null, null, {
                                    "method": "taobao.hotel.rooms.search",
                                    "gids": temp.join(",")
                                }, u.token));
                                temp = [];
                            }
                        });
                        if (temp.length > 0) {
                            promises.push(oauth.accessProtectedResource(null, null, {
                                "method": "taobao.hotel.rooms.search",
                                "gids": temp.join(",")
                            }, u.token));
                        }
                    }

                    return Promise.all(promises);
                }).then(function(result) { // taobao.hotel.rooms.search
                    var goods = {};
                    result.forEach(function(r) {
                        r = r["hotel_rooms_search_response"];
                        if (!r) return null;

                        r = r["rooms"];
                        if (!r) return null;

                        r = r["room"];
                        if (!r) return null;

                        r.forEach(function(g) {goods[g.gid] = g.status;});
                    });

                    var i, u;
                    var promises = [];
                    var gid_room_quota_map;
                    for (i in users) {
                        u = users[i];
                        if (u.expires < Date.now()) continue;

                        gid_room_quota_map = [];
                        u.forEach(function(g) {
                            if (!roomtypeids[g.roomtypeid]) {
                                if (goods[g.gid] == 1) {
                                    promises.push(oauth.accessProtectedResource(null, null, {
                                        "method": "taobao.hotel.room.update",
                                        "gid": g.gid,
                                        "status": 2
                                    }, u.token));
                                }
                                return null;
                            }
                            if (!roomtypeids[g.roomtypeid][g.ratetype]) {
                                if (goods[g.gid] == 1) {
                                    promises.push(oauth.accessProtectedResource(null, null, {
                                        "method": "taobao.hotel.room.update",
                                        "gid": g.gid,
                                        "status": 2
                                    }, u.token));
                                }
                                return null;
                            }

                            var temp = [];
                            var quotas = roomtypeids[g.roomtypeid][g.ratetype];
                            if (goods[g.gid] == 2 && Object.keys(quotas).length > 0) {
                                promises.push(oauth.accessProtectedResource(null, null, {
                                    "method": "taobao.hotel.room.update",
                                    "gid": g.gid,
                                    "status": 1
                                }, u.token));
                            }

                            var timestamp = Date.now();
                            var night, price, num;
                            var i = 0;
                            for (; i < 90; i += 1) {
                                night = dateformat(timestamp, "yyyy-mm-dd");
                                if (quotas[night]) {
                                    price = quotas[night]["preeprice"];
                                    if (g.ptype == 1) price = Math.ceil(price * (g.profit + 100) / 100) * 100;
                                    else if (g.ptype == 2) price = Math.ceil((price + g.profit)) * 100;

                                    num = quotas[night]["qtyable"];
                                    if (num < 0) num = 0;

                                    temp.push({
                                        date: night,
                                        price: price,
                                        num: num
                                    });
                                } else {
                                    temp.push({
                                        date: night,
                                        price: 9999999,
                                        num: 0
                                    });
                                }
                                timestamp += 24 * 60 * 60 * 1000;
                            }
                            gid_room_quota_map.push({
                                gid: g.gid,
                                roomQuota: temp
                            });
                        });

                        var length = Math.ceil(gid_room_quota_map.length / 30);
                        for (var j = 0; j < length; j += 1) {
                            promises.push(oauth.accessProtectedResource(null, null, {
                                "method": "taobao.hotel.rooms.update",
                                "gid_room_quota_map": JSON.stringify(gid_room_quota_map.slice(j * 30, (j + 1) * 30))
                            }, u.token));
                        }
                    }
                    return Promise.all(promises);
                }).then(function(result) { // taobao.hotel.rooms.update
                    result.forEach(function(i) {
                        if (i.hotel_rooms_update_response) {
                            i = i.hotel_rooms_update_response;
                            if (!i.gids) return null;

                            i = i.gids;
                            if (!i.string) return null;

                            time = dateformat(new Date(), "[yyyy-mm-dd HH:MM:ss]");
                            console.log(time, "taobao.hotel.rooms.update", i.string.sort().join(","), "(" + i.string.length, "gids)");
                        } else if (i.hotel_room_update_response) {
                            i = i.hotel_room_update_response;
                            if (!i.room) return null;

                            time = "[" + i.room.modified + "]";
                            if (i.room["status"] == 2) {
                                console.log(time, "taobao.hotel.room.update(delisting)", i.room.gid);
                            } else if (i.room["status"] == 1) {
                                console.log(time, "taobao.hotel.room.update(listing)", i.room.gid);
                            }
                        }
                    });
                })["catch"](function(e) {console.log(e);});
            } catch (e) {console.log(e);}
        },
        testAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            this.end({
                "Usercd": "SZ2747",
                "Authno": "123456",
                "msg": "成功"
            });

            var data = Object.keys(this.http.post || {})[0];
            if (!data) return null;

            try {
                data = JSON.parse(data);
                var roomtypeids = data.roomtypeids.replace(/\/$/, "").split('/');
                if (roomtypeids.length === 0) return null;

                var time = dateformat(Date.now(), "[yyyy-mm-dd HH:MM:ss]");
                console.log(time, "jielv.callback", roomtypeids.length, "roomtypeids");

                var users = {};
                var model = D("Goods").field("gid,userid,roomtypeid").where("status = 4 and roomtypeid in (" + roomtypeids.join(",") + ")");
                model.select().then(function(result) { // think_goods
                    result = result || [];
                    if (result.length === 0) return getDefer().promise;

                    var rtis = {};
                    var i = 0,
                        len = result.length;
                    var g;
                    for (; i < len; i += 1) {
                        g = result[i];
                        rtis[g.roomtypeid] = true;
                        if (!users[g.userid]) users[g.userid] = [];
                        users[g.userid].push(g.gid);
                    }

                    var where = "expires > now() and id in (" + Object.keys(users).join(",") + ")";
                    var m = D("User").field("id,token").where(where).select();
                    return Promise.all([m, prices2(Object.keys(rtis))]);
                }).then(function(result) { // hotelpriceall, think_user
                    var data = result[0] || [];
                    if (data.length === 0) return getDefer().promise;
                    if (result[1]["length"] === 0) return getDefer().promise;

                    data.forEach(function(u) {
                        users[u.id]["token"] = u.token;
                        users[u.id]["expires"] = u.expires;
                    });

                    var parameters = [];
                    var uarr = Object.keys(users);
                    var i = 0,
                        len = uarr.length;
                    var u, glen, j;
                    for (; i < len; i += 1) {
                        u = uarr[i];
                        u = users[u];

                        glen = Math.ceil(u.length / 20);
                        for (j = 0; j < glen; j += 1) {
                            parameters.push([u.slice(i * 20, (i + 1) * 20), u.token]);
                        }
                    }

                    var pieces = [];
                    var block = 500;
                    length = Math.ceil(parameters.length / block);
                    for (i = 0; i < length; i += 1) {
                        pieces.push(parameters.slice(i * block, (i + 1) * block));
                    }

                    roomtypeids = result[1];
                    return pieces.reduce(function(sequence, p) {
                        var data;
                        return sequence.then(function(result) {
                            data = result;
                            return Promise.all(p.map(function(param) {
                                return oauth.accessProtectedResource(null, null, {
                                    "method": "taobao.hotel.rooms.search",
                                    "gids": param[0]
                                }, param[1]);
                            }));
                        }).then(function(result) {
                            var goods = [];
                            var i = 0,
                                len = result.length;
                            var cluster;

                            var j, rlen, g;
                            for (; i < len; i += 1) {
                                if (result["hotel_rooms_search_response"] &&
                                    result["hotel_rooms_search_response"]["rooms"] &&
                                    result["hotel_rooms_search_response"]["rooms"]["room"]) {
                                    rlen = result["hotel_rooms_search_response"]["rooms"]["room"]["length"];
                                    for (j = 0; j < rlen; j += 1) {
                                        g = result["hotel_rooms_search_response"]["rooms"]["room"][j];
                                        goods.push([g.gid, g.status]);
                                    }
                                }
                            }
                            return data.concat(goods);
                        });
                    }, Promise.resolve([]));
                }).then(function(result) { // taobao.hotel.rooms.search
                    var time = dateformat(Date.now(), "[yyyy-mm-dd HH:MM:ss]");
                    console.log(time, result["length"]);
                    // var goods = {};
                    // result.forEach(function(r) {
                    //     r = r["hotel_rooms_search_response"];
                    //     if (!r) return null;

                    //     r = r["rooms"];
                    //     if (!r) return null;

                    //     r = r["room"];
                    //     if (!r) return null;

                    // });

                    // var i, u;
                    // var promises = [];
                    // var gid_room_quota_map;
                    // for (i in users) {
                    //     u = users[i];
                    //     if (u.expires < Date.now()) continue;

                    //     gid_room_quota_map = [];
                    //     u.forEach(function(g) {
                    //         if (!roomtypeids[g.roomtypeid]) {
                    //             if (goods[g.gid] == 1) {
                    //                 promises.push(oauth.accessProtectedResource(null, null, {
                    //                     "method": "taobao.hotel.room.update",
                    //                     "gid": g.gid,
                    //                     "status": 2
                    //                 }, u.token));
                    //             }
                    //             return null;
                    //         }
                    //         if (!roomtypeids[g.roomtypeid][g.ratetype]) {
                    //             if (goods[g.gid] == 1) {
                    //                 promises.push(oauth.accessProtectedResource(null, null, {
                    //                     "method": "taobao.hotel.room.update",
                    //                     "gid": g.gid,
                    //                     "status": 2
                    //                 }, u.token));
                    //             }
                    //             return null;
                    //         }

                    //         var temp = [];
                    //         var quotas = roomtypeids[g.roomtypeid][g.ratetype];
                    //         if (goods[g.gid] == 2 && Object.keys(quotas).length > 0) {
                    //             promises.push(oauth.accessProtectedResource(null, null, {
                    //                 "method": "taobao.hotel.room.update",
                    //                 "gid": g.gid,
                    //                 "status": 1
                    //             }, u.token));
                    //         }

                    //         var timestamp = Date.now();
                    //         var night, price, num;
                    //         var i = 0;
                    //         for (; i < 90; i += 1) {
                    //             night = dateformat(timestamp, "yyyy-mm-dd");
                    //             if (quotas[night]) {
                    //                 price = quotas[night]["preeprice"];
                    //                 if (g.ptype == 1) price = Math.ceil(price * (g.profit + 100) / 100) * 100;
                    //                 else if (g.ptype == 2) price = Math.ceil((price + g.profit)) * 100;

                    //                 num = quotas[night]["qtyable"];
                    //                 if (num < 0) num = 0;

                    //                 temp.push({
                    //                     date: night,
                    //                     price: price,
                    //                     num: num
                    //                 });
                    //             } else {
                    //                 temp.push({
                    //                     date: night,
                    //                     price: 9999999,
                    //                     num: 0
                    //                 });
                    //             }
                    //             timestamp += 24 * 60 * 60 * 1000;
                    //         }
                    //         gid_room_quota_map.push({
                    //             gid: g.gid,
                    //             roomQuota: temp
                    //         });
                    //     });

                    //     var length = Math.ceil(gid_room_quota_map.length / 30);
                    //     for (var j = 0; j < length; j += 1) {
                    //         promises.push(oauth.accessProtectedResource(null, null, {
                    //             "method": "taobao.hotel.rooms.update",
                    //             "gid_room_quota_map": JSON.stringify(gid_room_quota_map.slice(j * 30, (j + 1) * 30))
                    //         }, u.token));
                    //     }
                    // }
                    // return Promise.all(promises);
                // }).then(function(result) { // taobao.hotel.rooms.update
                    // result.forEach(function(i) {
                    //     if (i.hotel_rooms_update_response) {
                    //         i = i.hotel_rooms_update_response;
                    //         if (!i.gids) return null;

                    //         i = i.gids;
                    //         if (!i.string) return null;

                    //         time = dateformat(new Date(), "[yyyy-mm-dd HH:MM:ss]");
                    //         console.log(time, "taobao.hotel.rooms.update", i.string.sort().join(","), "(" + i.string.length, "gids)");
                    //     } else if (i.hotel_room_update_response) {
                    //         i = i.hotel_room_update_response;
                    //         if (!i.room) return null;

                    //         time = "[" + i.room.modified + "]";
                    //         if (i.room["status"] == 2) {
                    //             console.log(time, "taobao.hotel.room.update(delisting)", i.room.gid);
                    //         } else if (i.room["status"] == 1) {
                    //             console.log(time, "taobao.hotel.room.update(listing)", i.room.gid);
                    //         }
                    //     }
                    // });
                })["catch"](function(e) {console.log(e);});
            } catch (e) {console.log(e);}
        }
    };
});
