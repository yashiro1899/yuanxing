/**
 * controller
 * @return
 */
var oauth = require("../../../../taobao-oauth");
module.exports = Controller("Home/BaseController", function() {
    return {
        indexAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            this.display();
        }
    };
});
