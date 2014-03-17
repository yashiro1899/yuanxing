/**
 * controller
 * @return
 */
var oauth = require("../../../../taobao-oauth");
module.exports = Controller("Home/BaseController", function() {
    return {
        navType: "tasks",
        title: "已关联",
        indexAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            var data = {};
            var promise = oauth.accessProtectedResource(req, res, {
                "fields": "num_iid,list_time",
                "method": "taobao.items.onsale.get",
                "page_no": this.get("p"),
                "page_size": 20
            }).then(function(result) {
                var total = 0;

                if (result && result["items_onsale_get_response"]) {
                    total = result["items_onsale_get_response"]["total_results"];
                    result = result["items_onsale_get_response"]["items"];
                    result = result ? result["item"] : [];
                    result = result.map(function(i) {
                        data[i.num_iid] = {
                            "list_time": i.list_time
                        };
                        return i.num_iid;
                    });
                } else {
                    result = [];
                }

                if (result.length === 0) return getDefer().promise;
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
                    result.forEach(function(r, i) {
                        r.list_time = data[r.iid]["list_time"];
                    });
                } else {
                    result = [];
                }
                that.assign("list", result);
                that.display();
            });

            return promise;
        },
        testAction: function() {
            // that.end("<pre>" + JSON.stringify(result, null, 4) + "</pre>");
            // return;
            var that = this;
            var promise = oauth.accessProtectedResource(this.http.req, this.http.res, {
                "method": "taobao.hotel.get",
                "hid": 12345
            });

            return promise.then(function(result) {
                that.end("<pre>" + JSON.stringify(result, null, 4) + "</pre>");
            });
            // 50016161
        }
    };
});
