/**
 * controller
 * @return
 */
var cookie = require("cookie");
var cp = require("child_process");
var dateformat = require("dateformat");
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
            var res = this.http.res;
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
                expires: (new Date(90 * 24 * 60 * 60 * 1000 + Date.now()))
            });

            res.setHeader("Set-Cookie", data);
            this.end("haha");
        },
        callbackAction: function() {
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

                data = null;
                time = Date.now();
                var users = {};
                return D("User").field('id,token').where("expires > " + time).select().then(function(result) {
                    result = result || [];
                    if (result.length === 0) return getDefer().promise;

                    result.map(function(u) {users[u.id] = u.token;});
                    var model = D("Goods").field('roomtypeid').group("roomtypeid");
                    var where = "roomtypeid in (" + roomtypeids.join(",") + ") and ";
                    where += "userid in (" + Object.keys(users).join(",") + ") and ";
                    where += "status = 4";
                    roomtypeids = null;
                    return model.where(where).select();
                }).then(function(result) {
                    result = result || [];
                    if (result.length === 0) return getDefer().promise;

                    var ids = result.map(function(g) {return g.roomtypeid;});
                    cp.fork(__dirname + "/../../../../workers/updater.js").send({
                        roomtypeids: ids,
                        users: users
                    });
                });
            } catch (e) {console.log(e);}
        }
    };
});
