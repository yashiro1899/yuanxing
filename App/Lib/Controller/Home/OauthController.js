/**
 * controller
 * @return
 */
var cookie = require("cookie");
var oauth = require("../../../../taobao-oauth");
module.exports = Controller(function() {
    return {
        callbackAction: function() {
            var that = this;
            var promise = oauth.redirectCallback(this.http.req, this.http.res, this.get("code"));
            var values;

            return promise.then(function(result) {
                if (result) {
                    values = {
                        id: result["taobao_user_id"]
                    };
                    var model = D("User").where(values).select();
                    values.nick = result["taobao_user_nick"];
                    values.token = result["access_token"];
                    return model;
                } else {
                    that.logoutAction();
                    return getDefer().promise;
                }
            }).then(function(result) {
                result = result || [];
                if (result.length > 0) {
                    return D("User").update(values);
                } else {
                    return D("User").add(values);
                }
            }).then(function(result) {
                if (result !== false) that.redirect("/publish/");
                else that.logoutAction();
            });
        },
        logoutAction: function() {
            var now = new Date();
            var data = cookie.serialize("access_token.taobao", "", {
                path: "/",
                expires: now
            });

            this.http.res.setHeader("Set-Cookie", data);
            this.redirect("/");
        }
    };
});
