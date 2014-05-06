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

                    var promises = that.prices(Object.keys(roomtypeids).join("/"));
                    promises.push(D("User").field("id,token,expires").where("id in (" + Object.keys(users).join(",") + ")").select());
                    return Promise.all(promises);
                }).then(function(result) { // hotelpriceall, think_user
                    var data = [];
                    if (result[0] && result[0].success == 1) data.push(result[0].data);
                    if (result[1] && result[1].success == 1) data.push(result[1].data);
                    if (result[2] && result[2].success == 1) data.push(result[2].data);
                    if (data.length === 0) return getDefer().promise;

                    roomtypeids = {};
                    data.forEach(function(period) {
                        period.forEach(function(r) {
                            roomtypeids[r.roomtypeId] = {};
                            r.roomPriceDetail.forEach(function(rpd) {
                                if (!roomtypeids[r.roomtypeId][rpd.ratetype]) roomtypeids[r.roomtypeId][rpd.ratetype] = {};
                                var night = dateformat((new Date(rpd.night)), "yyyy-mm-dd");
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

                    // var i, u;
                    // var gid_room_quota_map;
                    // var promises = [];
                    // var now = Date.now();
                    // for (i in users) {
                    //     u = users[i];
                    //     if (u.expires < now) continue;

                    //     gid_room_quota_map = [];
                    //     u.forEach(function(g) {
                    //         if (!roomtypeids[g.roomtypeid]) return null;
                    //         if (!roomtypeids[g.roomtypeid][g.ratetype]) return null;

                    //         var quotas = [];
                    //         var n, night;
                    //         var price, num;
                    //         for (n in roomtypeids[g.roomtypeid][g.ratetype]) {
                    //             night = roomtypeids[g.roomtypeid][g.ratetype][n];
                    //             price = night.price;
                    //             num = night.num;

                    //             if (num < 0) num = 0;
                    //             if (g.ptype == 1) price = Math.ceil(price * (g.profit + 100) / 100) * 100;
                    //             else if (g.ptype == 2) price = Math.ceil((price + g.profit)) * 100;

                    //             quotas.push({
                    //                 date: n,
                    //                 price: price,
                    //                 num: num
                    //             });
                    //         }
                    //         gid_room_quota_map.push({
                    //             gid: g.gid,
                    //             roomQuota: quotas
                    //         });
                    //     });
                    //     promises.push(oauth.accessProtectedResource(null, null, {
                    //         "method": "taobao.hotel.rooms.update",
                    //         "gid_room_quota_map": JSON.stringify(gid_room_quota_map)
                    //     }, u.token));
                    // }

                    // return Promise.all(promises);
                // }).then(function(result) {
                    // time = dateformat(new Date(), "[yyyy-mm-dd HH:MM:ss]");
                    // var gids = [];
                    // var i, u;

                    // for (i in users) {
                    //     u = users[i];
                    //     gids = u.map(function(g) {return g.gid;});
                    //     console.log(time, "taobao.hotel.rooms.update", gids.join(","));
                    // }
                })["catch"](function(e) {console.log(e);});
            } catch (e) {console.log(e);}
        }
    };
});
