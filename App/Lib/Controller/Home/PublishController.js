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
                "name": hname
            });
            promise = promise.then(function(result) {
                that.end(result);
            });
            return promise;
        }
    };
});
