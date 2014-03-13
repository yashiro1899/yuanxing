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

            var page = parseInt(this.param("p"), 10) || 1;
            var range = 0;
            var promise = D("Hotel").field("hotelid").order("hotelid").page(page).select();

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

                range = data.length;
                data = data.map(function(h) {
                    var website = h.website.trim();
                    if (website.length > 0 && !(/^http/.test(website))) website = "http://" + website;
                    h.website = website;
                    return h;
                });
                that.assign("list", data);
                return D("Hotel").count();
            }).then(function(result) {
                var total = result || 0;
                var pagination = that.pagination(total, range, page);

                that.assign('pagination', pagination);
                that.display();
            });
            return promise;
        }
    };
});
