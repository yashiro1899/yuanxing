/**
 * controller
 * @return
 */
var oauth = require("../../../../taobao-oauth");
var jielvapi = require("../../../../jielv-api");
var areacode = require("../../../../define.conf");
var querystring = require('querystring');
var dateformat = require("dateformat");
module.exports = Controller("Home/BaseController", function() {
    return {
        navType: "publish",
        title: "发布",
        indexAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            var range = 0, total = 0;
            var page = parseInt(this.param("p"), 10) || 1;
            var query = this.param("q").trim();
            var country = this.param("c").trim();
            var province = this.param("s").trim();
            var formdata = {};

            var model1 = D("Hotel");
            var model2 = D("Hotel");
            if (query.length > 0) {
                formdata["q"] = query;
                model1 = model1.where("namechn like '%" + query + "%'");
                model2 = model2.where("namechn like '%" + query + "%'");
            }
            if (country.length > 0) {
                formdata["c"] = country;
                model1 = model1.where({country: country});
                model2 = model2.where({country: country});
            } else if (province.length > 0) {
                formdata["s"] = province;
                model1 = model1.where({state: province});
                model2 = model2.where({state: province});
            }
            this.assign("countries", areacode.country);
            this.assign("provinces", areacode.province);
            this.assign("formdata", formdata);

            var rooms = [];
            var promise1 = model1.order("hotelid").page(page).select();
            promise1 = promise1.then(function(result) {
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
                    roomstatus[r.roomtypeid] = {};
                    roomstatus[r.roomtypeid]["icon"] = "<i title=\"可发布\" class=\"icon-ok\"></i>";

                    if (goods[r.taobao_rid]) {
                        status = 2;
                        roomstatus[r.roomtypeid]["num_iid"] = goods[r.taobao_rid];
                    }
                    if (areacode.roomstatus[status]) {
                        roomstatus[r.roomtypeid]["icon"] = areacode.roomstatus[status];
                    }
                    roomstatus[r.roomtypeid]["status"] = status;
                });
                that.assign("roomstatus", roomstatus);
            });

            var promise2 = model2.count().then(function(result) {
                total = result || 0;
            });

            return Promise.all([promise1, promise2]).then(function(result) {
                var qs = querystring.stringify(formdata);
                var pagination = that.pagination(total, range, page, qs);
                that.assign('pagination', pagination);
                that.display();
            });
        },
        createAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            if (this.isPost()) {
                var roomtypeid = this.post("roomtypeid");
                var promise, start, end, data;

                if (!roomtypeid) {
                    this.end(null);
                    return null;
                }

                start = +(new Date());
                end = start + 30 * 24 * 60 * 60 * 1000;
                start = new Date(start);
                end = new Date(end);
                start = dateformat(start, "yyyy-mm-dd");
                end = dateformat(end, "yyyy-mm-dd");
                promise = jielvapi({
                    "QueryType": "hotelpriceall",
                    "roomtypeids": roomtypeid,
                    "checkInDate": start,
                    "checkOutDate": end
                }).then(function(result) {
                    data = [];
                    if (result && result.success == 1) data = result.data;
                    if (data.length === 0) {
                        that.end({
                            success: 8,
                            message: "暂无价格！"
                        });
                        return getDefer().promise;
                    }

                    data = data[0];
                    var m = D("Hotel").join("`think_room` on `think_room`.`hotelid` = `think_hotel`.`hotelid`");
                    m = m.field("think_hotel.taobao_hid,think_room.taobao_rid");
                    return m.where({"think_room.roomtypeid": roomtypeid}).select();
                }).then(function(result) {
                    result = result[0];
                    var title = data.hotelName + " " + data.roomtypeName;
                    var ratetype = data.roomPriceDetail[0]["ratetype"];
                    var quotas = data.roomPriceDetail.map(function(rpd) {
                        return {
                            date: rpd.night.slice(0, 10),
                            price: rpd.preeprice,
                            num: rpd.qtyable
                        };
                    });

                    return oauth.accessProtectedResource(req, res, {
                        "method": "taobao.hotel.room.add",
                        "hid": result.taobao_hid,
                        "rid": result.taobao_rid,
                        "title": title,
                        "bed_type": "B",
                        "breakfast": areacode.breakfast[ratetype] || "A",
                        "payment_type": "A",
                        "desc": title,
                        "room_quotas": JSON.stringify(quotas),
                        "pic_path": "http://img01.taobaocdn.com/bao/uploaded/i5/T1y86oFqhfXXaS6ecW_023222.jpg_310x310.jpg"
                    });
                }).then(function(result) {
                    that.end(result);
                });
                return promise;
            } else {
                this.end(null);
            }
        }
    };
});
