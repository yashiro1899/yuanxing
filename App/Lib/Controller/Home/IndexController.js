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

                var gids = [];
                var rids = [];
                result.forEach(function(i) {
                    gids.push(i.gid);
                    rids.push(i.roomtypeid);
                });

                var promises = [];
                var model;
                if (gids.length === 0) promises[0] = Promise.all([]);
                else promises[0] = oauth.accessProtectedResource(req, res, {
                    "gids": gids.join(','),
                    "method": "taobao.hotel.rooms.search",
                    "need_hotel": true,
                    "need_room_type": true
                });
                if (rids.length === 0) promises[1] = Promise.all([]);
                else {
                    model = D("Hotel").join("`think_room` on `think_room`.`hotelid` = `think_hotel`.`hotelid`");
                    model = model.field("think_hotel.original as h,think_room.original as r");
                    model = model.where("think_room.roomtypeid in (" + rids.join(",") + ")").select();
                    promises[1] = model;
                }

                return Promise.all(promises);
            }).then(function(result) {
                that.end("<pre>" + JSON.stringify(result, null, 4) + "</pre>");
            });
            return promise;
        }
    };
});
