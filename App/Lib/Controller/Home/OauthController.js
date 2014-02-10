/**
 * controller
 * @return
 */
var oauth = require("../../../../taobao-oauth");
module.exports = Controller(function() {
    return {
        callbackAction: function() {
            var promise = oauth.redirectCallback(this.http.req, this.http.res, this.get("code"));

            promise.then(function(result) {
                console.log(result);
            });
            this.end(this.get("code"));
        }
    }
});
