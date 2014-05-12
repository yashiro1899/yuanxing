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
    var start = Date.now();
    var end = start + 30 * 24 * 60 * 60 * 1000;

    for (var i = 0; i < 3; i += 1) {
        promises.push(jielvapi({
            "QueryType": "hotelpriceall",
            "roomtypeids": roomtypeids,
            "checkInDate": dateformat(start, "yyyy-mm-dd"),
            "checkOutDate": dateformat(end, "yyyy-mm-dd")
        }));

        start = end;
        end = start + 30 * 24 * 60 * 60 * 1000;
    }
    return promises;
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
            data = querystring.stringify(data);
            data = rot13(data);
            data = cookie.serialize("access_token.taobao", data, {
                path: "/",
                expires: (new Date(24 * 60 * 60 * 1000 + now))
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
                model.select().then(function(result) {
                    result = result || [];
                    if (result.length === 0) return getDefer().promise;

                    roomtypeids = {};
                    result.forEach(function(g) {
                        roomtypeids[g.roomtypeid] = true;

                        if (!users[g.userid]) users[g.userid] = [];
                        users[g.userid].push(g);
                    });

                    var promises = prices(Object.keys(roomtypeids).join("/"));
                    promises.push(D("User").field("id,token,expires").where("id in (" + Object.keys(users).join(",") + ")").select());
                    return Promise.all(promises);
                }).then(function(result) { // hotelpriceall, think_user
                    var data = [];
                    if (result[0] && result[0].data.length) data.push(result[0].data);
                    if (result[1] && result[1].data.length) data.push(result[1].data);
                    if (result[2] && result[2].data.length) data.push(result[2].data);
                    if (data.length === 0) return getDefer().promise;

                    roomtypeids = {};
                    data.forEach(function(period) {
                        period.forEach(function(r) {
                            if (!roomtypeids[r.roomtypeId]) roomtypeids[r.roomtypeId] = {};
                            r.roomPriceDetail.forEach(function(rpd) {
                                var night = dateformat((new Date(rpd.night)), "yyyy-mm-dd");
                                if (!roomtypeids[r.roomtypeId][rpd.ratetype]) roomtypeids[r.roomtypeId][rpd.ratetype] = {};
                                roomtypeids[r.roomtypeId][rpd.ratetype][night] = rpd;
                            });
                        });
                    });

                    data = result[3] || [];
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
                }).then(function(result) {
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

                    var i, u, temp;
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
                            if (goods[g.gid] == 2) {
                                promises.push(oauth.accessProtectedResource(null, null, {
                                    "method": "taobao.hotel.room.update",
                                    "gid": g.gid,
                                    "status": 1
                                }, u.token));
                            }

                            var temp = [];
                            var quotas = roomtypeids[g.roomtypeid][g.ratetype];
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

                        promises.push(oauth.accessProtectedResource(null, null, {
                            "method": "taobao.hotel.rooms.update",
                            "gid_room_quota_map": JSON.stringify(gid_room_quota_map)
                        }, u.token));
                    }
                    return Promise.all(promises);
                }).then(function(result) {
                    result.forEach(function(i) {
                        if (i.hotel_rooms_update_response) {
                            i = i.hotel_rooms_update_response;
                            if (!i.gids) return null;

                            i = i.gids;
                            if (!i.string) return null;

                            time = dateformat(new Date(), "[yyyy-mm-dd HH:MM:ss]");
                            console.log(time, "taobao.hotel.rooms.update", i.string.join(","));
                        } else if (i.hotel_room_update_response) {
                            i = i.hotel_room_update_response;
                            if (!i.room) return null;

                            time = "[" + i.modified + "]";
                            if (i.room["status"] == 2) {
                                console.log(time, "taobao.hotel.room.update(delisting)", i.gid);
                            } else {
                                console.log(time, "taobao.hotel.room.update", i.gid);
                            }
                        }
                    });
                    console.log(JSON.stringify(result, null, 4));
                })["catch"](function(e) {console.log(e);});
            } catch (e) {console.log(e);}
        }
    };
});
