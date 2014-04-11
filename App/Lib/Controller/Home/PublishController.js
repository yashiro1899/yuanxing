/**
 * controller
 * @return
 */
var cookie = require("cookie");
var dateformat = require("dateformat");
var jielvapi = require("../../../../jielv-api");
var mapping = require("../../../../define.conf");
var oauth = require("../../../../taobao-oauth");
var querystring = require('querystring');
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
            this.assign("countries", mapping.country);
            this.assign("provinces", mapping.province);
            this.assign("formdata", formdata);

            var rooms = [];
            var promise1 = model1.field("hotelid,namechn,website,original").order("hotelid").page(page).select();
            promise1 = promise1.then(function(result) { // think_hotel
                result = result || [];
                var rids = [];
                var data = result.map(function(h) {
                    var original = JSON.parse(h.original);
                    original["namechn"] = h.namechn;
                    original["website"] = h.website;
                    original.rooms.forEach(function(r) {rids.push(r.roomtypeid);});
                    return original;
                });

                range = data.length;
                that.assign("list", data);

                var promises = [], model;
                model = D("Room").field("roomtypeid,status,taobao_rid,no_price_expires");
                model = model.where("roomtypeid in (" + rids.join(",") + ")").select();
                promises.push(model);
                model = "userid = " + that.userInfo["taobao_user_id"];
                model += " and roomtypeid in (" + rids.join(",") + ")";
                model = D("Goods").field("roomtypeid,status").where(model).select();
                promises.push(model);
                return Promise.all(promises);
            }).then(function(result) { // think_room, think_goods
                var promises = [];
                var goods = result[1] || [];
                var rids = {};
                goods.forEach(function(g) {rids[g.roomtypeid] = g;});
                goods = rids;

                rids = [];
                rooms = result[0] || [];
                rooms.forEach(function(r, i) {
                    if (goods[r.roomtypeid]) rooms[i]["status"] = goods[r.roomtypeid]["status"];
                    else if (r.taobao_rid > 0) rids.push(r.taobao_rid);

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
            }).then(function(result) { // taobao.hotel.rooms.search
                var goods = {};
                var roomstatus = {};
                result.forEach(function(g) {
                    if (g && g["hotel_rooms_search_response"]) {
                        g = g["hotel_rooms_search_response"]["rooms"];
                        g = g ? g["room"] : [];
                        g.forEach(function(r) {
                            goods[r.rid] = r.iid;
                        });
                    }
                });

                rooms.forEach(function(r) {
                    var status = r.status;
                    roomstatus[r.roomtypeid] = {};

                    if (goods[r.taobao_rid]) status = 2;
                    if (r.no_price_expires > Date.now()) status = 5; // 暂无价格

                    roomstatus[r.roomtypeid]["icon"] = mapping.roomstatus[status] ||
                        '<input class="action-select" type="checkbox" value="' + r.roomtypeid + '" checked />';
                    roomstatus[r.roomtypeid]["status"] = status;
                });
                that.assign("roomstatus", roomstatus);
            });

            var promise2 = model2.count().then(function(result) {total = result || 0;});

            return Promise.all([promise1, promise2]).then(function(result) {
                var qs = querystring.stringify(formdata);
                var pagination = that.pagination(total, range, page, qs);
                that.assign('pagination', pagination);
                that.display();
            });
        },
        inquiryAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            if (this.isPost()) {
                var roomtypeid = this.post("roomtypeid");
                var promise, start, end;
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
                    var data = [];
                    if (result && result.success == 1) data = result.data;
                    if (data.length === 0) {
                        that.end({
                            success: 8,
                            message: "暂无价格！"
                        });

                        var model = D("Room");
                        model.pk = "roomtypeid";
                        return model.update({
                            roomtypeid: roomtypeid,
                            no_price_expires: Date.now() + 7 * 24 * 60 * 60 * 1000
                        });
                    }
                    that.end(data[0]);
                });
            } else {
                this.end(null);
            }
        },
        createAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            if (this.isPost()) {
                var data = this.post("data");
                if (!data) {
                    this.end(null);
                    return null;
                }
                try {
                    data = JSON.parse(data);
                } catch(e) {
                    this.end(null);
                    return null;
                }

                var gid = 0, iid = 0;
                var promise = D("Hotel").join("`think_room` on `think_room`.`hotelid` = `think_hotel`.`hotelid`");
                promise = promise.field("think_hotel.taobao_hid,think_room.taobao_rid,think_room.original");
                promise = promise.where({"think_room.roomtypeid": data.roomtypeId}).select();
                promise.then(function(result) { // think_hotel, think_room
                    result = result[0];

                    var original = JSON.parse(result["original"]);
                    var detail = data.roomPriceDetail[0];
                    var title = data.hotelName + " " + data.roomtypeName;
                    var bedtype = mapping.bedtype[original.bedtype] || "B";
                    var storey = parseInt(original["floordistribution"].replace(/^\D/, ""), 10) || 3;
                    var quotas = {};
                    data.roomPriceDetail.forEach(function(rpd) {
                        var night = dateformat((new Date(rpd.night)), "yyyy-mm-dd");
                        if (rpd.ratetype != detail.ratetype) return null;
                        quotas[night] = {
                            date: night,
                            price: 9999999,
                            num: rpd.qtyable
                        };
                    });
                    var temp = [], i;
                    for (i in quotas) temp.push(quotas[i]);
                    quotas = temp;

                    var size = parseFloat(original["bedsize"].replace(/^\D/, "")) || 1.5;
                    if (size <= 1) size = "A";
                    else if (size > 2.2) size = "H";
                    else if (mapping.bedsize[size]) size = mapping.bedsize[size];
                    else size = "E";

                    var area = parseInt(original["acreages"].replace(/^\D/, ""), 10) || 20;
                    if (area <= 15) area = "A";
                    else if (area > 15 && area <= 30) area = "B";
                    else if (area > 30 && area <= 50) area = "C";
                    else area = "D";

                    var breakfast = "A";
                    if (detail.ratetype == 16 || detail.ratetype == 56) breakfast = "B";
                    else if (detail.ratetype == 9) breakfast = "C";

                    var bbn = "A";
                    if (detail["internetprice"] != 3 && detail["netcharge"] === 0) bbn = "B";
                    else if (detail["internetprice"] != 3 && detail["netcharge"] !== 0) bbn = "C";

                    return oauth.accessProtectedResource(req, res, {
                        "method": "taobao.hotel.room.add",
                        "hid": result.taobao_hid,
                        "rid": result.taobao_rid,
                        "title": title,
                        "area": area, // optional
                        "size": size, // optional
                        "bed_type": bedtype,
                        "storey": storey, // optional
                        "breakfast": breakfast,
                        "bbn": bbn, // optional
                        "payment_type": "A",
                        "desc": title,
                        "room_quotas": JSON.stringify(quotas),
                        "pic": __dirname + "/../../../../www/static/img/placeholder.jpg"
                    });
                }).then(function(result) { // taobao.hotel.room.add
                    if (!result || result["error_response"]) {
                        that.end({
                            success: 8,
                            message: result["error_response"]["sub_msg"] || "暂无价格！"
                        });
                        return null;
                    }

                    result = result["hotel_room_add_response"]["room"];
                    gid = result.gid;
                    iid = result.iid;
                    return D("Goods").add({
                        gid: result.gid,
                        userid: that.userInfo["taobao_user_id"],
                        hotelid: data.hotelId,
                        roomtypeid: data.roomtypeId,
                        iid: result.iid
                    });
                }).then(function(result) { // think_goods
                    var now = +(new Date());
                    var content = "发布成功！";
                    content += "<a href=\"http://kezhan.trip.taobao.com/item.htm?item_id=";
                    content += (iid + "\" target=\"_blank\">去淘宝查看</a>");
                    res.setHeader("Set-Cookie", cookie.serialize("success.message", content, {
                        path: "/",
                        expires: (new Date(24 * 60 * 60 * 1000 + now))
                    }));

                    that.end({
                        success: 1,
                        message: "发布成功！",
                        gid: gid
                    });
                });
                return promise;
            } else {
                this.end(null);
            }
        }
    };
});
