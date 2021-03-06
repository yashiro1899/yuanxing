/**
 * 后台controller基类
 * @return {[type]} [description]
 */
var dateformat = require("dateformat");
var oauth = require("../../../../taobao-oauth");
var jielvapi = require("../../../../jielv-api.js");
module.exports = Controller(function() {
    return {
        userInfo: {},
        init: function(http) {
            this.super_("init", http);
            this.assign("title", this.title || "");
            this.assign("navType", this.navType || "");
            this.assign("staticversion", "1405020197");

            var that = this;
            return oauth.getUserInfo(this.http.req, this.http.res).then(function(u) {
                that.userInfo = u;
                that.assign("userInfo", that.userInfo);
            });
        },
        pagination: function(total, range, current, querystring, limit) {
            var ON_EACH_SIDE = 3;
            var ON_ENDS = 2;
            var pagination = {
                required: false
            };
            var list, num_pages, i;

            pagination["total"] = total;
            pagination["range"] = range;
            pagination["item"] = "Hotels";
            if (total > 0 && range > 0 && total > range) {
                num_pages = Math.ceil(total / 20);
                num_pages = num_pages > limit ? limit : num_pages;
                pagination["required"] = true;
                pagination["current"] = current;
                pagination["num_pages"] = num_pages;

                list = [];
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
                        for (i = num_pages - ON_ENDS + 1; i <= num_pages; i += 1) list.push(i);
                    } else {
                        for (i = current + 1; i <= num_pages; i += 1) list.push(i);
                    }
                }
                pagination["list"] = list;
                pagination["querystring"] = "";
                if (querystring) pagination["querystring"] = "&" + querystring;
            }
            return pagination;
        },
        prices: function(roomtypeids) { // limit: roomtypeids.length <= 20
            var promises = [];
            var start = Date.now();
            var end = start + 30 * 24 * 60 * 60 * 1000;

            for (var i = 0; i < 3; i += 1) {
                promises.push(jielvapi({
                    "QueryType": "hotelpriceall",
                    "roomtypeids": roomtypeids,
                    "checkInDate": dateformat(start, "yyyy-mm-dd"),
                    "checkOutDate": dateformat(end, "yyyy-mm-dd")
                }));

                start = end;
                end = start + 30 * 24 * 60 * 60 * 1000;
            }
            return promises;
        }
    };
});
