/**
 * controller
 * @return
 */
var cookie = require("cookie");
var oauth = require("../../../../taobao-oauth");
module.exports = Controller("Home/BaseController", function() {
    return {
        navType: "tasks",
        title: "已关联",
        indexAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            var message = this.cookie("success.message");
            var now = new Date();
            this.assign("message", message);
            this.http.res.setHeader("Set-Cookie", cookie.serialize("success.message", "", {
                path: "/",
                expires: now
            }));

            var page = parseInt(this.param("p"), 10) || 1;
            var query = this.param("q").trim();
            var formdata = {};
            var promise, data;
            if (query.length > 0) {
                formdata["q"] = query;
                promise = D("Hotel").field("hotelid").where("namechn like '%" + query + "%'").select();
                promise = promise.then(function(result) {
                    result = result || [];
                    var ids = result.map(function(h) {return h.hotelid;});
                    var model = D("Goods");
                    if (ids.length > 0) model = model.where("hotelid in (" + ids.join(",") + ")");
                    return model.order("updated_at desc").page(page).select();
                });
            }
            if (!promise) promise = D("Goods").order("updated_at desc").page(page).select();

            promise = promise.then(function(result) {
                result = result || [];
                that.end("<pre>" + JSON.stringify(result, null, 4) + "</pre>")
            });
            return promise;
        }
    };
});
