/**
 * 后台controller基类
 * @return {[type]} [description]
 */
var oauth = require("../../../../taobao-oauth");
module.exports = Controller(function() {
    return {
        userInfo: {},
        init: function(http) {
            this.super_("init", http);
            this.assign("title", this.title || "");
            this.assign("navType", this.navType || "");

            var that = this;
            return oauth.getUserInfo(this.http.req, this.http.res).then(function(u) {
                that.userInfo = u;
                that.assign("userInfo", that.userInfo);
            });
        },
        pagination: function(total, range, current) {
            var ON_EACH_SIDE = 3;
            var ON_ENDS = 2;
            var pagination = {
                required: false
            };
            var list, num_pages, i;

            if (total > 0 && range > 0 && total > range) {
                num_pages = Math.ceil(total / 20);
                pagination["required"] = true;
                pagination["total"] = total;
                pagination["range"] = range;
                pagination["num_pages"] = num_pages;
                pagination["item"] = "Hotels";

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
                        for (i = num_pages - ON_ENDS; i <= num_pages; i += 1) list.push(i);
                    } else {
                        for (i = current + 1; i <= num_pages; i += 1) list.push(i);
                    }
                }
                pagination["list"] = list;
            }
            return pagination;
        }
    };
});
