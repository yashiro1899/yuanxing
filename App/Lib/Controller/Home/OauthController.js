/**
 * controller
 * @return
 */
var oauth = require("../../../../taobao-oauth");
var cookie = require("cookie");
module.exports = Controller(function() {
    return {
        callbackAction: function() {
            var that = this;
            var promise = oauth.redirectCallback(this.http.req, this.http.res, this.get("code"));

            return promise.then(function(result) {
                that.redirect("/");
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
