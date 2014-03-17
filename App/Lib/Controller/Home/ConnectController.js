/**
 * controller
 * @return
 */
var oauth = require("../../../../taobao-oauth");
var querystring = require('querystring');
module.exports = Controller("Home/BaseController", function() {
    return {
        navType: "connect",
        title: "关联",
        indexAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            var page = parseInt(this.param("p"), 10) || 1;
            var range = 0;
            var query = this.param("q").trim();
            var formdata = {};
            var params = {
                "fields": "num_iid",
                "method": "taobao.items.onsale.get",
                "page_no": page,
                "page_size": 20
            };
            if (query.length > 0) {
                formdata["q"] = query;
                params["q"] = query;
            }
            this.assign("formdata", formdata);
            this.assign("tab", "onsale");

            var promise = oauth.accessProtectedResource(req, res, params);
            promise.then(function(result) {
                if (result && result["items_onsale_get_response"]) {
                    result = result["items_onsale_get_response"]["items"];
                    result = result ? result["item"] : [];
                    result = result.map(function(h) {
                        return h.num_iid;
                    });
                } else {
                    result = [];
                }

                if (result.length === 0) {
                    that.assign("list", result);
                    that.display();
                    return getDefer().promise;
                }
                return oauth.accessProtectedResource(req, res, {
                    "item_ids": result.join(','),
                    "method": "taobao.hotel.rooms.search",
                    "need_hotel": true,
                    "need_room_type": true
                });
            }).then(function(result) {
                var total = 0;

                if (result && result["hotel_rooms_search_response"]) {
                    total = result["hotel_rooms_search_response"]["total_results"];
                    result = result["hotel_rooms_search_response"]["rooms"];
                    result = result ? result["room"] : [];
                } else {
                    result = [];
                }
                range = result.length;

                var qs = querystring.stringify(formdata);
                var pagination = that.pagination(total, range, page, qs);

                that.assign("list", result);
                that.assign('pagination', pagination);
                that.display();
            });

            return promise;
        }
    };
});
