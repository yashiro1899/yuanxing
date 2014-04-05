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
            var promise;
            if (query.length > 0) {
                formdata["q"] = query;
                promise = D("Hotel").field("hotelid").where("namechn like '%" + query + "%'").select();
                promise = promise.then(function(result) {
                    result = result || [];
                    var ids = result.map(function(h) {return h.hotelid;});
                    var model = D("Goods").where("hotelid in (" + ids.join(",") + ")");
                    return model.order("updated_at desc").page(page).select();
                });
            }
            if (!promise) promise = D("Goods").order("updated_at desc").page(page).select();

            promise = promise.then(function(result) {
                that.end("<pre>" + JSON.stringify(result, null, 4) + "</pre>")
            });
            return promise;
            // var data = {};
            // var promise = oauth.accessProtectedResource(req, res, {
            //     "fields": "num_iid,list_time",
            //     "method": "taobao.items.onsale.get",
            //     "page_no": this.get("p"),
            //     "page_size": 20
            // }).then(function(result) {
            //     var total = 0;

            //     if (result && result["items_onsale_get_response"]) {
            //         total = result["items_onsale_get_response"]["total_results"];
            //         result = result["items_onsale_get_response"]["items"];
            //         result = result ? result["item"] : [];
            //         result = result.map(function(i) {
            //             data[i.num_iid] = {
            //                 "list_time": i.list_time
            //             };
            //             return i.num_iid;
            //         });
            //     } else {
            //         result = [];
            //     }

            //     if (result.length === 0) return getDefer().promise;
            //     return oauth.accessProtectedResource(req, res, {
            //         "item_ids": result.join(','),
            //         "method": "taobao.hotel.rooms.search",
            //         "need_hotel": true,
            //         "need_room_type": true
            //     });
            // }).then(function(result) {
            //     var total = 0;

            //     if (result && result["hotel_rooms_search_response"]) {
            //         total = result["hotel_rooms_search_response"]["total_results"];
            //         result = result["hotel_rooms_search_response"]["rooms"];
            //         result = result ? result["room"] : [];
            //         result.forEach(function(r, i) {
            //             r.list_time = data[r.iid]["list_time"];
            //         });
            //     } else {
            //         result = [];
            //     }
            //     that.assign("list", result);
            //     that.display();
            // });

            // return promise;
        }
    };
});
