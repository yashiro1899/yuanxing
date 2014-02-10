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

            var that = this;
            return ( new oauth() ).getUserInfo(this.http.req, this.http.res).then(function(u) {
                console.log(u);
                that.userInfo = u;
                that.assign("userInfo", that.userInfo);
            });
        }
    };
});
