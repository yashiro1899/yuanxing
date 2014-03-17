/**
 * 后台controller基类
 * @return {[type]} [description]
 */
var oauth = require("../../../../taobao-oauth");
module.exports = Controller(function() {
    return {
        userInfo: {},
        hotcities: {
            70002: "深圳",
            30000909: "曼谷",
            30000908: "新加坡",
            30001050: "东京",
            70082: "北京",
            70058: "上海",
            30001043: "首尔",
            30001048: "苏梅岛",
            70011: "广州",
            30001017: "台北",
            30000898: "香港",
            30001059: "河内",
            30001047: "普吉岛",
            30001060: "胡志明",
            30001046: "芭堤雅",
            30001055: "大阪",
            30001049: "吉隆坡",
            70030: "三亚",
            70059: "杭州",
            30001051: "清迈",
            70021: "武汉",
            70038: "成都",
            70025: "长沙",
            70079: "厦门",
            70120: "大连",
            30001045: "曼谷",
            30001057: "雅加达",
            70003: "珠海",
            70045: "重庆",
            70063: "南京",
            70029: "海口",
            70068: "苏州",
            70119: "沈阳",
            70020: "桂林",
            30001056: "冲绳",
            70139: "澳门",
            70096: "青岛",
            70007: "东莞",
            70083: "天津",
            70046: "西安",
            30001052: "槟城"
        },
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
        pagination: function(total, range, current, querystring) {
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
        }
    };
});
