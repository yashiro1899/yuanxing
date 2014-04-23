/**
 * controller
 * @return
 */
var cookie = require("cookie");
var dateformat = require("dateformat");
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
                console.log(data); // TODO: remove it

                var roomtypeids = data.roomtypeids.replace(/\/$/, "").split('/');
                if (roomtypeids.length === 0) return null;

                var users = {};
                var model = D("Goods").where("roomtypeid in (" + roomtypeids.join(",") + ")");
                model.select().then(function(result) {
                    result = result || [];
                    if (result.length === 0) return getDefer().promise;

                    roomtypeids = {};
                    result.forEach(function(g) {
                        roomtypeids[g.roomtypeid] = true;
                        if (!users[g.userid]) users[g.userid] = [];
                        users[g.userid].push(g);
                    });

                    var promises, start, end;
                    start = +(new Date());
                    end = start + 30 * 24 * 60 * 60 * 1000;
                    start = new Date(start);
                    end = new Date(end);
                    start = dateformat(start, "yyyy-mm-dd");
                    end = dateformat(end, "yyyy-mm-dd");
                    promises.push(jielvapi({
                        "QueryType": "hotelpriceall",
                        "roomtypeids": Object.keys(roomtypeids).join("/"),
                        "checkInDate": start,
                        "checkOutDate": end
                    }));
                    promises.push(D("User").field("id,token,expires").where("id in (" + Object.keys(users).join(",") + ")").select());
                    return Promise.all(promises);
                }).then(function(result) { // hotelpriceall, think_user
                    var data = [];
                    if (result[0] && result[0].success == 1) data = result[0].data;
                    if (data.length === 0) return getDefer().promise;

                    var list = result[1] || [];
                    if (list.length === 0) return getDefer().promise;
                    list.forEach(function(u) {
                        if (users[u.id]) {
                            users[u.id]["token"] = u.token;
                            users[u.id]["expires"] = u.expires;
                        }
                    });

                    var time = dateformat(new Date(), "[yyyy-mm-dd HH:MM:ss]");
                    console.log(time, result);
                });
            } catch (e) {console.log(e);}
        }
    };
});
