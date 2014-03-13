/**
 * controller
 * @return
 */
var oauth = require("../../../../taobao-oauth");
var jielvapi = require("../../../../jielv-api");
var querystring = require('querystring');
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
            var query = this.param("q");
            var formdata = {};
            var model = D("Hotel");
            if (query.length > 0) {
                formdata["q"] = query;
                model = model.where("namechn like '%" + query + "%'");
            }
            this.assign("formdata", formdata);

            var promise = model.field("hotelid").order("hotelid").page(page).select();
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

                model = D("Hotel");
                if (query.length > 0) model = model.where("namechn like '%" + query + "%'");
                return model.count();
            }).then(function(result) {
                var total = result || 0;
                var qs = querystring.stringify(formdata);
                var pagination = that.pagination(total, range, page, qs);

                that.assign('pagination', pagination);
                that.display();
            });
            return promise;
        }
    };
});
