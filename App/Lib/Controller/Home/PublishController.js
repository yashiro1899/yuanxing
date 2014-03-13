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
            var pagination = {
                required: false,
                current: page,
                item: "Hotels"
            };
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

                pagination["range"] = data.length;
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
                var range = pagination.range;
                var current = pagination.current;
                var list = [], num_pages, i;
                var ON_EACH_SIDE = 3;
                var ON_ENDS = 2;

                if (total > 0 && range > 0 && total > range) {
                    num_pages = Math.ceil(result / 20);
                    pagination["required"] = true;
                    pagination["total"] = result;
                    pagination["num_pages"] = num_pages;

                    if (num_pages <= 8) {
                        for (i = 1; i <= num_pages; i += 1) list.push(i);
                    } else {
                        if (current > (ON_EACH_SIDE + ON_ENDS + 1)) {
                            for (i = 1; i <= ON_ENDS; i += 1) list.push(i);
                            list.push(".");
                            for (i = current - ON_EACH_SIDE; i <= current; i += 1) list.push(i);
                        } else {
                            for (i = 1; i <= current; i += 1) list.push(i);
                        }

                        if (current < (num_pages - ON_EACH_SIDE - ON_ENDS)) {
                            for (i = current + 1; i <= current + ON_EACH_SIDE; i += 1) list.push(i);
                            list.push(".");
                            for (i = num_pages - ON_ENDS; i <= num_pages; i += 1) list.push(i);
                        } else {
                            for (i = current + 1; i <= num_pages; i += 1) list.push(i);
                        }
                    }
                    pagination["list"] = list;
                }
                that.assign('pagination', pagination);
                that.display();
            });
            return promise;
        }
    };
});
