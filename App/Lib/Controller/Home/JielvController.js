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
                "roomtypeids": roomtypeids.slice(i * 20, (i + 1) * 20).join("/"),
                "checkInDate": dateformat(start, "yyyy-mm-dd"),
                "checkOutDate": dateformat(end, "yyyy-mm-dd")
            });

            start = end;
            end = start + 30 * 24 * 60 * 60 * 1000;
        }
    }

    var pieces = [];
    var block = 1200;
    length = Math.ceil(parameters.length / block);
    for (i = 0; i < length; i += 1) {
        pieces.push(parameters.slice(i * block, (i + 1) * block));
    }

    var quotas = {};
    return pieces.reduce(function(sequence, p) {
        return sequence.then(function(result) {
            return Promise.all(p.map(function(param) {
                param["QueryType"] = "hotelpriceall";
                return jielvapi(param);
            }));
        }).then(function(result) {
            var i = 0, len = result.length, cluster;
            for (; i < len; i += 1) {
                cluster = result[i];
                if (cluster && cluster.data && cluster.data.length) {
                    cluster.data.forEach(function(room) {
                        var id = room.roomtypeId;
                        if (!quotas[id]) quotas[id] = {};

                        room.roomPriceDetail.forEach(function(rpd) {
                            if (rpd.qtyable < 1) return null;
                            var type = rpd.ratetype;
                            var night, price;

                            if (!quotas[id][type]) quotas[id][type] = {};
                            night = dateformat((new Date(rpd.night)), "yyyy-mm-dd");
                            price = quotas[id][type][night];
                            if (price && price.price < rpd.preeprice) return null;
                            quotas[id][type][night] = {
                                price: rpd.preeprice,
                                num: rpd.qtyable
                            };
                        });
                    });
                }
            }
            return quotas;
        })["catch"](function(e) {console.log(e);});
    }, Promise.resolve());
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
                var tokens = {};
                var model = "status = 4 and roomtypeid in (" + roomtypeids.join(",") + ")";
                    model = D("Goods").field("gid,userid,roomtypeid,ratetype,ptype,profit").where(model);
                model.select().then(function(result) { // think_goods
                    result = result || [];
                    if (result.length === 0) return getDefer().promise;

                    roomtypeids = {};
                    var i = 0, len = result.length, g;
                    for (; i < len; i += 1) {
                        g = result[i];
                        roomtypeids[g.roomtypeid] = true;
                        if (!users[g.userid]) users[g.userid] = {};
                        users[g.userid][g.gid] = {
                            roomtypeid: g.roomtypeid,
                            ratetype: g.ratetype,
                            ptype: g.ptype,
                            profit: g.profit
                        };
                    }

                    return D("User").field("id,token,expires").where("id in (" + Object.keys(users).join(",") + ")").select();
                }).then(function(result) { // think_user
                    result = result || [];
                    if (result.length === 0) return getDefer().promise;

                    result.forEach(function(u) {
                        if (u.expires < Date.now()) return null;
                        tokens[u.id] = u.token;
                    });
                    return prices2(Object.keys(roomtypeids));
                }).then(function(result) { // hotelpriceall
                    var parameters = [];
                    var uarr = Object.keys(users);
                    var i = 0, len = uarr.length, u;
                    var token;

                    var j, glen;
                    for (; i < len; i += 1) {
                        u = uarr[i];
                        token = tokens[u];
                        if (!token) continue;

                        u = users[u];
                        u = Object.keys(u).filter(function(g) {
                            g = u[g];
                            var rtid = g.roomtypeid;
                            if (!result[rtid]) return false;
                            if (!result[rtid][g.ratetype]) return false;
                            g.status = true;
                            return true;
                        });

                        glen = Math.ceil(u.length / 30);
                        for (j = 0; j < glen; j += 1) {
                            parameters.push({
                                gids: u.slice(j * 30, (j + 1) * 30),
                                token: token
                            });
                        }
                    }
                    if (parameters.length === 0) return getDefer().Promise;

                    var pieces = [];
                    var block = 800;
                    length = Math.ceil(parameters.length / block);
                    for (i = 0; i < length; i += 1) {
                        pieces.push(parameters.slice(i * block, (i + 1) * block));
                    }

                    var quotas = result;
                    return pieces.reduce(function(sequence, p) {
                        return sequence.then(function(result) {
                            return Promise.all(p.map(function(param) {
                                var userid = param.token.slice(47);
                                var gid_room_quota_map = [];
                                param.gids.forEach(function(g) {
                                    var gid = g;
                                    g = users[userid][gid];

                                    var roomQuota = [];
                                    var time = Date.now();
                                    var night, price, num;
                                    var i = 0;
                                    for (; i < 90; i += 1) {
                                        night = dateformat(time, "yyyy-mm-dd");
                                        price = quotas[g.roomtypeid][g.ratetype][night];
                                        if (price) {
                                            num = price.num;
                                            price = price.price;
                                            if (g.ptype == 1) price = Math.ceil(price * (g.profit + 100) / 100) * 100;
                                            else if (g.ptype == 2) price = Math.ceil((price + g.profit)) * 100;
                                            roomQuota.push({
                                                date: night,
                                                price: price,
                                                num: num
                                            });
                                        } else {
                                            roomQuota.push({
                                                date: night,
                                                price: 9999999,
                                                num: 0
                                            });
                                        }
                                        time += 24 * 60 * 60 * 1000;
                                    }
                                    gid_room_quota_map.push({
                                        gid: gid,
                                        roomQuota: roomQuota
                                    });
                                });
                                return oauth.accessProtectedResource(null, null, {
                                    "method": "taobao.hotel.rooms.update",
                                    "gid_room_quota_map": JSON.stringify(gid_room_quota_map)
                                }, param.token);
                            }));
                        }).then(function(result) {
                            var i = 0, len = result.length, re;
                            for (; i < len; i += 1) {
                                re = result[i];
                                if (!re) continue;

                                re = re["hotel_rooms_update_response"];
                                if (!re) continue;

                                re = re["gids"];
                                if (!re) continue;

                                re = re["string"];
                                if (!re) continue;

                                var time = dateformat(new Date(), "[yyyy-mm-dd HH:MM:ss]");
                                console.log(time, "taobao.hotel.rooms.update", re.sort().join(","), "/ " + re.length);
                            }
                        })["catch"](function(e) {console.log(e);});
                    }, Promise.resolve());
                }).then(function(result) { // taobao.hotel.rooms.update
                    var parameters = [];
                    var uarr = Object.keys(users);
                    var i = 0, len = uarr.length, u;
                    var token;

                    var j, glen;
                    for (; i < len; i += 1) {
                        u = uarr[i];
                        token = tokens[u];
                        if (!token) continue;

                        u = users[u];
                        u = Object.keys(u);
                        glen = Math.ceil(u.length / 20);
                        for (j = 0; j < glen; j += 1) {
                            parameters.push({
                                gids: u.slice(j * 20, (j + 1) * 20),
                                token: token
                            });
                        }
                    }

                    var pieces = [];
                    var block = 800;
                    length = Math.ceil(parameters.length / block);
                    for (i = 0; i < length; i += 1) {
                        pieces.push(parameters.slice(i * block, (i + 1) * block));
                    }

                    var statuses = {};
                    return pieces.reduce(function(sequence, p) {
                        return sequence.then(function(result) {
                            return Promise.all(p.map(function(param) {
                                return oauth.accessProtectedResource(null, null, {
                                    "method": "taobao.hotel.rooms.search",
                                    "gids": param.gids.join(",")
                                }, param.token);
                            }));
                        }).then(function(result) {
                            var i = 0, len = result.length, cluster;
                            for (; i < len; i += 1) {
                                cluster = result[i];
                                if (cluster["hotel_rooms_search_response"] &&
                                    cluster["hotel_rooms_search_response"]["rooms"] &&
                                    cluster["hotel_rooms_search_response"]["rooms"]["room"]) {
                                    cluster["hotel_rooms_search_response"]["rooms"]["room"].forEach(function(g) {
                                        statuses[g.gid] = g.status;
                                    });
                                }
                            }
                            return statuses;
                        })["catch"](function(e) {console.log(e);});
                    }, Promise.resolve());
                }).then(function(result) { // taobao.hotel.rooms.search
                    var parameters = [];
                    var uarr = Object.keys(users);
                    var i = 0, len = uarr.length, u;
                    var token;
                    for (; i < len; i += 1) {
                        u = uarr[i];
                        token = tokens[u];
                        if (!token) continue;

                        u = users[u];
                        Object.keys(u).forEach(function(g) {
                            var gid = g;
                            g = u[gid];

                            if (result[gid] == 1 && !g.status) parameters.push({
                                gid: gid,
                                status: 2,
                                token: token
                            });
                            else if (result[gid] == 2 && g.status) parameters.push({
                                gid: gid,
                                status: 1,
                                token: token
                            });
                        });
                    }
                    if (parameters.length === 0) return getDefer().Promise;

                    var pieces = [];
                    var block = 800;
                    length = Math.ceil(parameters.length / block);
                    for (i = 0; i < length; i += 1) {
                        pieces.push(parameters.slice(i * block, (i + 1) * block));
                    }

                    return pieces.reduce(function(sequence, p) {
                        return sequence.then(function(result) {
                            return Promise.all(p.map(function(param) {
                                return oauth.accessProtectedResource(null, null, {
                                    "method": "taobao.hotel.room.update",
                                    "gid": param.gid,
                                    "status": param.status
                                }, param.token);
                            }));
                        }).then(function(result) {
                            var i = 0, len = result.length, cluster;
                            for (; i < len; i += 1) {
                                cluster = result[i];
                                if (cluster["hotel_rooms_update_response"] &&
                                    cluster["hotel_rooms_update_response"]["room"]) {
                                    var time = "[" + i.room.modified + "]";
                                    var room = cluster["hotel_rooms_update_response"]["room"];
                                    if (room["status"] == 2) console.log(time, "taobao.hotel.room.update(delisting)", room.gid);
                                    else if (room["status"] == 1) console.log(time, "taobao.hotel.room.update(listing)", room.gid);
                                }
                            }
                        })["catch"](function(e) {console.log(e);});
                    }, Promise.resolve());
                })["catch"](function(e) {console.log(e);});
            } catch (e) {console.log(e);}
        }
    };
});
