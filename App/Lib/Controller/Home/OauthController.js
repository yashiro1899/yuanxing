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
            var values;

            if (this.get("error") || !this.get("code")) {
                var message = "<br/><br/>登录失败！有任何问题，请联系 ";
                message += "<a href=\"mailto:yashiro1899@gmail.com\">yashiro1899@gmail.com</a>";
                that.end(that.get("error_description") + message);
                return null;
            }
            var promise = oauth.redirectCallback(this.http.req, this.http.res, this.get("code"));

            return promise.then(function(result) {
                if (result) { // TODO: expires_in
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
