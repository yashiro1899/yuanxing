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
            var taobaorooms = {};
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

                if (rids.length === 0) {
                    total = 0;
                    var qs = querystring.stringify(formdata);
                    var pagination = that.pagination(total, range, page, qs);
                    that.assign('pagination', pagination);
                    that.display();
                    return getDefer().promise;
                }

                var promises = [],
                    model;
                model = D("Room").field("roomtypeid,status,no_price_expires");
                model = model.where("roomtypeid in (" + rids.join(",") + ")").select();
                promises.push(model);

                model = "userid = " + that.userInfo["taobao_user_id"];
                model += " and roomtypeid in (" + rids.join(",") + ")";
                model = D("Goods").field("roomtypeid,status").where(model).select();
                promises.push(model);

                model = D("Taobaoroom").where("roomtypeid in (" + rids.join(",") + ")").select();
                promises.push(model);

                return Promise.all(promises);
            }).then(function(result) { // think_room, think_goods, think_taobaoroom
                var promises = [];

                var goods = result[1] || [];
                var temp = {};
                goods.forEach(function(g) {
                    if (!temp[g.roomtypeid]) temp[g.roomtypeid] = [];
                    temp[g.roomtypeid].push(g);
                });
                goods = temp;

                taobaorooms = result[2] || [];
                temp = {};
                taobaorooms.forEach(function(tr) {
                    if (!temp[tr.roomtypeid]) temp[tr.roomtypeid] = [];
                    temp[tr.roomtypeid].push(tr);
                });
                taobaorooms = temp;

                var hids = {};
                rooms = result[0] || [];
                rooms.forEach(function(r, i) {
                    var gd = goods[r.roomtypeid];
                    var tr = taobaorooms[r.roomtypeid];

                    if (gd) {
                        var connected = gd.some(function(g) {return g.status == 4;});
                        r["status"] = connected ? 4 : 3;
                    } else if (tr) {
                        tr.forEach(function(r) {hids[r.hid] = true;});
                    }

                });

                temp = [];
                hids = Object.keys(hids);
                hids.forEach(function(h) {
                    temp.push(h);
                    if (temp.length == 5) {
                        promises.push(oauth.accessProtectedResource(req, res, {
                            "method": "taobao.hotel.rooms.search",
                            "hids": temp.join(",")
                        }));
                        temp = [];
                    }
                });
                if (temp.length > 0) {
                    promises.push(oauth.accessProtectedResource(req, res, {
                        "method": "taobao.hotel.rooms.search",
                        "hids": temp.join(",")
                    }));
                }
                return Promise.all(promises);
            }).then(function(result) { // taobao.hotel.rooms.search
                var goods = {};
                result.forEach(function(g) {
                    if (g && g["hotel_rooms_search_response"]) {
                        g = g["hotel_rooms_search_response"]["rooms"];
                        g = g ? g["room"] : [];
                        g.forEach(function(r) {goods[r.rid] = r.iid;});
                    }
                });

                var roomstatus = {};
                rooms.forEach(function(r) {
                    var status = r.status;
                    var tr = taobaorooms[r.roomtypeid];
                    roomstatus[r.roomtypeid] = {};

                    if (tr && tr.some(function(r) {return goods[r.rid];})) status = 2;
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
        quotasAction: function() {
            var that = this;
            var roomtypeid = this.param("roomtypeid");
            if (!roomtypeid) {
                this.end(null);
                return null;
            }

            return Promise.all(this.prices(roomtypeid)).then(function(result) {
                var quotas = {};
                result.forEach(function(period) {
                    if (period && period.data && period.data.length > 0) {
                        var room = period.data[0];
                        room.roomPriceDetail.forEach(function(rpd) {
                            if (rpd.qtyable < 1) return null;
                            var type = rpd.ratetype;
                            var night, price;

                            if (!quotas[type]) quotas[type] = {};
                            night = dateformat((new Date(rpd.night)), "yyyy-mm-dd");
                            price = quotas[type][night];
                            if (price && price.price < rpd.preeprice) return null;

                            quotas[type][night] = {
                                price: rpd.preeprice,
                                num: rpd.qtyable
                            };
                        });
                    }
                });

                var model;
                if (Object.keys(quotas)['length'] === 0) {
                    that.end({
                        success: 8,
                        message: "暂无价格！"
                    });

                    model = D("Room");
                    model.pk = "roomtypeid";
                    return model.update({
                        roomtypeid: roomtypeid,
                        no_price_expires: (Date.now() + 7 * 24 * 60 * 60 * 1000)
                    });
                }
                that.end({
                    success: 1,
                    data: quotas
                });
            });
        },
        createAction: function() {
            if (!this.isPost()) {
                this.end(null);
                return null;
            }

            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            var roomtypeid = this.post("roomtypeid");
            var modelroom = D("Room").join("think_hotel on think_room.hotelid = think_hotel.hotelid").field("think_room.original,think_hotel.hotelid,think_hotel.namechn").where({
                "roomtypeid": roomtypeid
            });
            var modeltaobao = D("Taobaoroom").where({"roomtypeid": roomtypeid}).order("rid desc");
            var modeluser = D("User").field("pic_path,guide").where({
                id: this.userInfo["taobao_user_id"]
            });

            var goods, hotelid;
            return Promise.all([modelroom.select(), modeltaobao.select(), modeluser.select()]).then(function(result) {
                var room = result[0][0];
                var taobao = result[1][0];
                var user = result[2][0];
                room.original = JSON.parse(room.original);
                hotelid = room.hotelid;

                var title = room.namechn + " " + room.original.namechn;
                var area, size, bedtype, storey;
                bedtype = (mapping.bedtype[room.original.bedtype] || "B");

                var quotas = [];
                var i = 0, time = Date.now();
                for (; i < 3; i += 1) {
                    quotas.push({
                        date: dateformat(time, "yyyy-mm-dd"),
                        price: 9999999,
                        num: 0
                    });
                    time += 24 * 60 * 60 * 1000;
                }

                var params = {
                    "method": "taobao.hotel.room.add",
                    "hid": taobao.hid,
                    "rid": taobao.rid,
                    "title": title,
                    "bed_type": bedtype,
                    "breakfast": "A",
                    "payment_type": "A",
                    "desc": title,
                    "room_quotas": JSON.stringify(quotas),
                    "receipt_type": "A",
                    "has_receipt": true,
                    "refund_policy_info": JSON.stringify({t: 2})
                };

                if ((area = parseInt(room.original.acreages, 10))) {
                    if (area <= 15) area = "A";
                    else if (area > 15 && area <= 30) area = "B";
                    else if (area > 30 && area <= 50) area = "C";
                    else area = "D";
                    params["area"] = area;
                }

                if ((size = parseFloat(room.original.bedsize))) {
                    if (size <= 1) size = "A";
                    else if (size > 2.2) size = "H";
                    else if (mapping.bedsize[size]) size = mapping.bedsize[size];
                    else size = "E";
                    params["size"] = size;
                }

                if ((storey = parseInt(room.original.floordistribution, 10))) params["storey"] = storey;

                var pieces;
                if (user.pic_path) {
                    pieces = user.pic_path.split("/");
                    pieces = pieces.slice(-3);
                    params["pic_path"] = "/" + pieces.join("/");
                } else {
                    params["pic"] = __dirname + "/../../../../www/static/img/placeholder.jpg";
                }
                if (user.guide) params["guide"] = user.guide;
                return oauth.accessProtectedResource(req, res, params);
            }).then(function(result) { // taobao.hotel.room.add
                if (result && (result = result["hotel_room_add_response"]) && (result = result["room"])) {
                    goods = result;
                    return D("Goods").add({
                        gid: result.gid,
                        userid: that.userInfo["taobao_user_id"],
                        hotelid: hotelid,
                        roomtypeid: roomtypeid,
                        iid: result.iid
                    });
                } else if (result && (result = result["error_response"])) {
                    that.end({
                        success: 8,
                        message: (result.sub_msg || result.msg)
                    });
                    return getDefer().promise;
                } else {
                    that.end({
                        success: 8,
                        message: "暂无价格！"
                    });
                    return getDefer().promise;
                }
            }).then(function(result) { // think_goods
                var content = "发布成功！";
                content += "<a href=\"http://kezhan.trip.taobao.com/item.htm?item_id=";
                content += (goods.iid + "\" target=\"_blank\">去淘宝查看</a>");
                res.setHeader("Set-Cookie", cookie.serialize("success.message", content));

                that.end({
                    success: 1,
                    message: "发布成功！",
                    gid: goods.gid
                });
            });
        }
    };
});
