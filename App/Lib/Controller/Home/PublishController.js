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

            var range = 0;
            var page = parseInt(this.param("p"), 10) || 1;
            var query = this.param("q").trim();
            var city = this.param("c").trim();
            var formdata = {};
            var model = D("Hotel");
            if (query.length > 0) {
                formdata["q"] = query;
                model = model.where("namechn like '%" + query + "%'");
            }
            if (city.length > 0) {
                formdata["c"] = city;
                model = model.where({city: city});
            }
            this.assign("hotcities", this.hotcities);
            this.assign("formdata", formdata);

            var promise = model.order("hotelid").page(page).select();
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
                if (city.length > 0) model = model.where({city: city});
                return model.count();
            }).then(function(result) {
                var total = result || 0;
                var qs = querystring.stringify(formdata);
                var pagination = that.pagination(total, range, page, qs);

                that.assign('pagination', pagination);
                that.display();
            });
            return promise;
        },
        confirmAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            var hid = this.param("hid");
            var rid = this.param("rid");
            var hname = this.param("hname");
            var rname = this.param("rname");
            var domestic = this.param("domestic") == "true";

            var promise = oauth.accessProtectedResource(req, res, {
                "domestic": domestic,
                "method": "taobao.hotel.name.get",
                "name": hname,
                "province": 440000
            });
            promise = promise.then(function(result) {
                that.end(result);
            });
            return promise;
        }
    };
});
