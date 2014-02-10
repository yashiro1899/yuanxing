/**
 * controller
 * @return
 */
var oauth = require("../../../../taobao-oauth");
module.exports = Controller(function() {
    return {
        callbackAction: function() {
            var that = this;
            var promise = oauth.redirectCallback(this.http.req, this.http.res, this.get("code"));

            return promise.then(function(result) {
                that.redirect("/");
            });
        }
    }
});
