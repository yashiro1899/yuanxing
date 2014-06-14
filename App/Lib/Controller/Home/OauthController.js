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
                if (result) {
                    values = {
                        id: result["taobao_user_id"]
                    };
                    var model = D("User").where(values).select();
                    values.nick = decodeURIComponent(result["taobao_user_nick"]);
                    values.token = result["access_token"];
                    values.expires = +(new Date(result["expires_in"] * 1000 + Date.now()));
                    return model;
                } else {
                    that.logoutAction();
                    return getDefer().promise;
                }
            }).then(function(result) {
                result = result || [];
                var model;

                if (result.length > 0) {
                    model = D("User").update(values);
                    values = (result[0]["pic_path"] && result[0]["guide"]);
                } else {
                    values.guide = "";
                    model = D("User").add(values);
                    values = false;
                }
                return model;
            }).then(function(result) {
                if (result !== false) {
                    if (!values) that.redirect("/user/");
                    else that.redirect("/publish/");
                } else {
                    that.logoutAction();
                }
            });
        },
        logoutAction: function() {
            this.http.res.setHeader("Set-Cookie", cookie.serialize("access_token.taobao", "", {
                expires: (new Date())
            }));
            this.redirect("/");
        }
    };
});
