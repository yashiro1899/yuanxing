/**
 * controller
 * @return
 */
var oauth = require("../../../../taobao-oauth");
var jielvapi = require("../../../../jielv-api");
var querystring = require('querystring');
var areacode = require("../../../../define.conf");
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
            var country = this.param("c").trim();
            var province = this.param("s").trim();
            var formdata = {};
            var model = D("Hotel");
            if (query.length > 0) {
                formdata["q"] = query;
                model = model.where("namechn like '%" + query + "%'");
            }
            if (country.length > 0) {
                formdata["c"] = country;
                model = model.where({country: country});
            } else if (province.length > 0) {
                formdata["s"] = province;
                model = model.where({state: province});
            }
            this.assign("countries", areacode.country);
            this.assign("provinces", areacode.province);
            this.assign("formdata", formdata);

            var rooms = [];
            var promise = model.order("hotelid").page(page).select();
            promise = promise.then(function(result) {
                var ids = result.map(function(h) {return h.hotelid;});
                return jielvapi({
                    "QueryType": "hotelinfo",
                    "hotelIds": ids.join("/")
                });
            }).then(function(result) {
                var data = [], rids = [];
                if (result && result.success == 1) data = result.data;

                range = data.length;
                data = data.map(function(h) {
                    var website = h.website.trim();
                    if (website.length > 0 && !(/^http/.test(website))) website = "http://" + website;
                    h.website = website;

                    h.rooms.forEach(function(r) {
                        rids.push(r.roomtypeid);
                    });
                    return h;
                });
                that.assign("list", data);

                return D("Room").field("roomtypeid,status,taobao_rid").where("roomtypeid in (" + rids.join(",") + ")").select();
            }).then(function(result) {
                var promises = [];
                var rids = [];

                rooms = result || [];
                rooms.forEach(function(r) {
                    if (r.taobao_rid > 0) rids.push(r.taobao_rid);
                    if (rids.length == 20) {
                        promises.push(oauth.accessProtectedResource(req, res, {
                            "method": "taobao.hotel.rooms.search",
                            "rids": rids.join(",")
                        }));
                        rids = [];
                    }
                });
                if (rids.length > 0) {
                    promises.push(oauth.accessProtectedResource(req, res, {
                        "method": "taobao.hotel.rooms.search",
                        "rids": rids.join(",")
                    }));
                }

                return Promise.all(promises);
            }).then(function(result) {
                var goods = {};
                var roomstatus = {};
                result.forEach(function(g) {
                    if (g && g["hotel_rooms_search_response"]) {
                        g = g["hotel_rooms_search_response"]["rooms"];
                        g = g ? g["room"] : [];
                        if (g.length > 0) {
                            g = g[0];
                            goods[g.rid] = g.iid;
                        }
                    }
                });

                rooms.forEach(function(r) {
                    var status = r.status;
                    if (goods[r.taobao_rid]) status = 2;
                    roomstatus[r.roomtypeid] = "<i class=\"icon-ok\"></i>"; // 可发布
                    if (areacode.roomstatus[status]) {
                        roomstatus[r.roomtypeid] = areacode.roomstatus[status];
                    }
                });
                that.assign("roomstatus", roomstatus);

                model = D("Hotel");
                if (query.length > 0) model = model.where("namechn like '%" + query + "%'");
                if (country.length > 0) {
                    model = model.where({country: country});
                } else if (province.length > 0) {
                    model = model.where({state: province});
                }
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
                "domestic": false,
                "method": "taobao.hotels.search",
                "name": "濠景",
                "country": "Singapore"
            });
            promise = promise.then(function(result) {
                that.end(result);
            });
            return promise;
        }
    };
});
