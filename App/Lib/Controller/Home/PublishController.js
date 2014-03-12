/**
 * controller
 * @return
 */
var oauth = require("../../../../taobao-oauth");
var jielvapi = require("../../../../jielv-api");
module.exports = Controller("Home/BaseController", function() {
    return {
        navType: "publish",
        title: "发布",
        indexAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;
            var promise = D("Hotel").field("hotelid").order("hotelid").page(2).select();

            promise = promise.then(function(result) {
                var ids = result.map(function(h) {
                    return h.hotelid;
                });
                return jielvapi({
                    "QueryType": "hotelinfo",
                    "hotelIds": ids.join("/")
                });
            }).then(function(result) {
                var data = [];
                if (result && result.success == 1) data = result.data;

                that.assign("list", data);
                that.display();
                return D("Hotel").count();
            }).then(function(result) {
                console.log(result);
            });
            return promise;
        }
    };
});
