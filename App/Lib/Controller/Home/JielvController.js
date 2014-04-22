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
            var time = dateformat(new Date(), "[yyyy-mm-dd HH:MM:ss]");
            if (!data) return null;

            try {
                data = JSON.parse(data);

                var roomtypeids = data.roomtypeids.replace(/\/$/, "").split('/');
                if (roomtypeids.length === 0) return null;

                var model = D("Goods").where("roomtypeid in (" + roomtypeids.join(",") + ")");
                roomtypeids = {};
                model.select().then(function(result) {
                    result = result || [];
                    if (result.length === 0) return getDefer().promise;

                    var users = {};
                    result.forEach(function(g) {
                        roomtypeids[g.roomtypeid] = true;
                        if (!users[g.userid]) users[g.userid] = [];
                        userid[g.userid].push(g);
                    });
                });
            } catch (e) {console.log(e);}
        }
    };
});
