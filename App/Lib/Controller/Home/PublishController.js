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

            var hotels = {};
            var promise1 = model1.order("hotelid").page(page).select();
            promise1 = promise1.then(function(result) { // think_hotel
                result = result || [];
                var hids = [];
                var rids = [];
                var data = result.map(function(h) {
                    var original = JSON.parse(h.original);
                    var name = h.namechn;
                    original["namechn"] = name;
                    original["website"] = h.website;

                    hids.push(h.hotelid);
                    if (!hotels[name]) hotels[name] = {};
                    original.rooms.forEach(function(r) {
                        rids.push(r.roomtypeid);
                        hotels[name][r.namechn.trim()] = r.roomtypeid;
                    });
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

                model = D("Taobaohotel").where("hotelid in (" + hids.join(",") + ")").order('hid desc').select();
                promises.push(model);

                return Promise.all(promises);
            }).then(function(result) { // think_room, think_taobaohotel
                var hids = result[2] || [];
                var promises = [];
                var flags = {};
                hids.forEach(function(h) {
                    if (flags[h.hotelid]) return null;
                    promises.push(oauth.accessProtectedResource(req, res, {
                        "hid": h.hid,
                        "method": "taobao.hotel.get",
                        "need_room_type": true
                    }));
                    flags[h.hotelid] = true;
                });
                promises.push(result[1]);
                promises.push(result[0]);
                return Promise.all(promises);
            }).then(function(result) { // taobao.hotel.get
                var rooms = result.pop() || [];
                var goods = result.pop() || [];

                var taobao = {};
                result.forEach(function(h) {
                    if (h && (h = h["hotel_get_response"]) && (h = h.hotel)) {
                        var name = h.name;
                        if (hotels[name] && (h = h.room_types) && h.room_type) {
                            h.room_type.forEach(function(room) {
                                var roomtypeid = hotels[name][room.name.trim()];
                                if (roomtypeid) {
                                    taobao[roomtypeid] = {
                                        hid: room.hid,
                                        rid: room.rid
                                    };
                                }
                            });
                        }
                    }
                });

                var exists = {};
                goods.forEach(function(g) {
                    exists[g.roomtypeid] = g.status;
                });

                var rids = [];
                rooms.forEach(function(r) {
                    var rtid = r.roomtypeid;
                    if (exists[rtid]) {
                        r.status = exists[rtid];
                    } else if (taobao[rtid]) {
                        r.status = 128;
                        r.taobao = taobao[rtid];
                        rids.push(taobao[rtid]["rid"]);
                    }
                });

                var promises = [];
                var length = Math.ceil(rids.length / 20);
                for (var i = 0; i < length; i += 1) {
                    promises.push(oauth.accessProtectedResource(req, res, {
                        "method": "taobao.hotel.rooms.search",
                        "rids": rids.slice(i * 20, (i + 1) * 20).join(",")
                    }));
                }
                promises.push(rooms);
                return Promise.all(promises);
            }).then(function(result) { // taobao.hotel.rooms.search
                var rooms = result.pop();
                var exists = {};
                result.forEach(function(g) {
                    if (g && g["hotel_rooms_search_response"]) {
                        g = g["hotel_rooms_search_response"]["rooms"];
                        g = g ? (g["room"] || []) : [];
                        g.forEach(function(r) {exists[r.rid] = true;});
                    }
                });

                rooms.forEach(function(r) {
                    if (r.taobao && exists[r.taobao.rid]) {
                        r.status = 2;
                    }
                });

                var roomstatus = {};
                rooms.forEach(function(r) {
                    var status = r.status;
                    var rtid = r.roomtypeid;
                    if (r.no_price_expires > Date.now()) status = 5; // 暂无价格
                    if (status == 128 && !r.taobao) status = 1;

                    roomstatus[rtid] = {};
                    roomstatus[rtid]["icon"] = mapping.roomstatus[status];
                    roomstatus[rtid]["status"] = status;
                    if (status == 128) {
                        roomstatus[rtid]['icon'] = '<input class="action-select" type="checkbox" checked />';
                        roomstatus[rtid]['hid'] = r.taobao.hid;
                        roomstatus[rtid]['rid'] = r.taobao.rid;
                    }
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
                        no_price_expires: (Date.now() + 5 * 60 * 1000)
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
            var hid = this.post("hid");
            var rid = this.post("rid");
            var modelroom = D("Room").join("think_hotel on think_room.hotelid = think_hotel.hotelid").field("think_room.original,think_hotel.hotelid,think_hotel.namechn").where({
                "roomtypeid": roomtypeid
            });
            var modeluser = D("User").field("pic_path,guide").where({
                id: this.userInfo["taobao_user_id"]
            });

            var goods, hotelid;
            return Promise.all([modelroom.select(), modeluser.select()]).then(function(result) {
                var room = result[0][0];
                var user = result[1][0];

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
                    "hid": hid,
                    "rid": rid,
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
                var copy = result;
                if (result && (result = result["hotel_room_add_response"]) && (result = result["room"])) {
                    goods = result;
                    return D("Goods").add({
                        gid: result.gid,
                        userid: that.userInfo["taobao_user_id"],
                        hotelid: hotelid,
                        roomtypeid: roomtypeid,
                        iid: result.iid
                    });
                } else if ((result = copy) && (result = result["error_response"])) {
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
                res.setHeader("Set-Cookie", cookie.serialize("success.message", content, {path: "/"}));

                that.end({
                    success: 1,
                    message: "发布成功！",
                    gid: goods.gid
                });
            });
        }
    };
});
