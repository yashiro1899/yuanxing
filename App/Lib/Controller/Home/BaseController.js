/**
 * 后台controller基类
 * @return {[type]} [description]
 */
var oauth = require("../../../../taobao-oauth");
module.exports = Controller(function() {
    return {
        userInfo: {},
        init: function(http) {
            this.super_("init", http);
            this.assign("title", this.title || "");
            this.assign("navType", this.navType || "");

            var that = this;
            return oauth.getUserInfo(this.http.req, this.http.res).then(function(u) {
                that.userInfo = u;
                that.assign("userInfo", that.userInfo);
            });
        }
    };
});
