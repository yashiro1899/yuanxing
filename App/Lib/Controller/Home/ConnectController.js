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
var url = require("url");
module.exports = Controller("Home/BaseController", function() {
    return {
        navType: "connect",
        title: "关联",
        listAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            var message = this.cookie("success.message");
            this.assign("message", message);

            var cookies = [];
            cookies.push(cookie.serialize("success.message", "", {
                path: "/",
                expires: (new Date())
            }));
            cookies.push(cookie.serialize("back.url", req.url, {path: "/"}));
            res.setHeader("Set-Cookie", cookies);

            var range = 0, total = 0;
            var page = parseInt(this.param("p"), 10) || 1;
            var query = this.param("q").trim();
            var formdata = {};
            var params = {
                "cid": 50016161,
                "fields": "num_iid",
                "method": "taobao.items.onsale.get",
                "order_by": "modified:desc",
                "page_no": page,
                "page_size": 20
            };
            if (query.length > 0) {
                formdata["q"] = query;
                params["q"] = query;
            }
            this.assign("formdata", formdata);
            this.assign("tab", "onsale");

            var goods = [];
            var promise = oauth.accessProtectedResource(req, res, params);
            promise = promise.then(function(result) { // taobao.items.onsale.get
                if (result && result["items_onsale_get_response"]) {
                    total = result["items_onsale_get_response"]["total_results"];
                    result = result["items_onsale_get_response"]["items"];
                    result = result ? (result["item"] || []) : [];
                    result = result.map(function(h) {
                        return h.num_iid;
                    });
                } else {
                    result = [];
                }
                if (result.length === 0) return null;

                return oauth.accessProtectedResource(req, res, {
                    "item_ids": result.join(','),
                    "method": "taobao.hotel.rooms.search",
                    "need_hotel": true,
                    "need_room_type": true
                });
            }).then(function(result) { // taobao.hotel.rooms.search
                if (result && result["hotel_rooms_search_response"]) {
                    result = result["hotel_rooms_search_response"]["rooms"];
                    result = result ? (result["room"] || []) : [];
                } else {
                    result = [];
                }
                goods = result;
                range = result.length;

                var qs = querystring.stringify(formdata);
                var pagination = that.pagination(total, range, page, qs);
                that.assign('pagination', pagination);

                var ids = goods.map(function(g) {
                    g["goodstatus"] = 0;
                    g["goodstatusicon"] = mapping.goodstatus[0];
                    return g.gid;
                });
                if (ids.length === 0) {
                    that.assign("list", goods);
                    that.display();
                    return getDefer().promise;
                }
                return D("Goods").field("gid").where("gid in (" + ids.join(",") + ") and status = 4").select();
            }).then(function(result) { // think_goods
                var exists = {};
                result = result || [];
                result.forEach(function(g) {exists[g.gid] = true;});
                goods.forEach(function(g, i) {
                    if (exists[g.gid]) {
                        g["goodstatus"] = 2;
                        g["goodstatusicon"] = mapping.goodstatus[2];
                    }
                });

                var ids = goods.filter(function(g) {if (g.goodstatus === 0) return true;});
                ids = ids.map(function(g) {return g.hid;});
                if (ids.length === 0) {
                    that.assign("list", goods);
                    that.display();
                    return getDefer().promise;
                }

                var temp = {};
                ids.forEach(function(i) {temp[i] = true;});
                ids = Object.keys(temp);
                ids = "hid in (" + ids.join(",") + ")";
                return D("Taobaohotel").field("hid,hotelid").where(ids).select();
            }).then(function(result) { // think_taobaohotel
                var exists = {};
                result = result || [];
                result.forEach(function(h) {exists[h.hid] = h.hotelid;});
                goods.forEach(function(g) {
                    if (exists[g.hid]) {
                        g["goodstatus"] = 1;
                        g["goodstatusicon"] = mapping.goodstatus[1];
                        g["hotelid"] = exists[g.hid];
                    }
                });

                var ids = goods.filter(function(g) {if (g.goodstatus === 1) return true;});
                ids = ids.map(function(g) {return g.hotelid;});
                if (ids.length === 0) {
                    that.assign("list", goods);
                    that.display();
                    return getDefer().promise;
                }
                return D("Hotel").field("hotelid,original").where('hotelid in (' + ids.join(',') + ')').select();
            }).then(function(result) { // think_hotel
                var exists = {};
                result = result || [];
                result.forEach(function(h) {
                    var hotel = JSON.parse(h.original);
                    exists[h.hotelid] = {};
                    hotel.rooms.forEach(function(r) {
                        exists[h.hotelid][r.namechn] = r.roomtypeid;
                    });
                });
                goods.forEach(function(g) {
                    var hotelid = g.hotelid;
                    var name = g.room_type.name;
                    if (exists[hotelid] && exists[hotelid][name]) {
                        g["goodstatus"] = 128;
                        g["goodstatusicon"] = "<img src=\"/static/img/icon-yes.gif\" />";
                        g["roomtypeid"] = exists[hotelid][name];
                    }
                });
                that.assign("list", goods);
                that.display('connect:index');
            });
            return promise;
        },
        indexAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            var message = this.cookie("success.message");
            this.assign("message", message);

            var cookies = [];
            cookies.push(cookie.serialize("success.message", "", {
                path: "/",
                expires: (new Date())
            }));
            cookies.push(cookie.serialize("back.url", req.url, {path: "/"}));
            res.setHeader("Set-Cookie", cookies);

            var range = 0, total = 0;
            var page = parseInt(this.param("p"), 10) || 1;
            var query = this.param("q").trim();
            var formdata = {};
            var params = {
                "cid": 50016161,
                "fields": "num_iid",
                "method": "taobao.items.onsale.get",
                "order_by": "modified:desc",
                "page_no": page,
                "page_size": 20
            };
            if (query.length > 0) {
                formdata["q"] = query;
                params["q"] = query;
            }
            this.assign("formdata", formdata);
            this.assign("tab", "onsale");

            var goods = [];
            var promise = oauth.accessProtectedResource(req, res, params);
            promise = promise.then(function(result) { // taobao.items.onsale.get
                if (result && result["items_onsale_get_response"]) {
                    total = result["items_onsale_get_response"]["total_results"];
                    result = result["items_onsale_get_response"]["items"];
                    result = result ? result["item"] : [];
                    result = result.map(function(h) {
                        return h.num_iid;
                    });
                } else {
                    result = [];
                }
                if (result.length === 0) return null;

                return oauth.accessProtectedResource(req, res, {
                    "item_ids": result.join(','),
                    "method": "taobao.hotel.rooms.search",
                    "need_hotel": true,
                    "need_room_type": true
                });
            }).then(function(result) { // taobao.hotel.rooms.search
                if (result && result["hotel_rooms_search_response"]) {
                    result = result["hotel_rooms_search_response"]["rooms"];
                    result = result ? result["room"] : [];
                } else {
                    result = [];
                }
                goods = result;
                range = result.length;

                var qs = querystring.stringify(formdata);
                var pagination = that.pagination(total, range, page, qs);
                that.assign('pagination', pagination);

                var ids = goods.map(function(g, i) {
                    g["goodstatus"] = 0;
                    g["goodstatusicon"] = mapping.goodstatus[0];
                    return g.gid;
                });
                if (ids.length === 0) {
                    that.assign("list", goods);
                    that.display();
                    return getDefer().promise;
                }
                return D("Goods").field("gid,status").where("gid in (" + ids.join(",") + ")").select();
            }).then(function(result) { // think_goods
                var exists = {};
                result = result || [];
                result.forEach(function(g) {exists[g.gid] = g.status;});
                goods.forEach(function(g, i) {
                    if (exists[g.gid] && exists[g.gid] == 4) {
                        g["goodstatus"] = 2;
                        g["goodstatusicon"] = mapping.goodstatus[2];
                    }
                });

                var ids = goods.filter(function(g) {if (g.goodstatus === 0) return true;});
                ids = ids.map(function(g) {return g.hid;});
                if (ids.length === 0) {
                    that.assign("list", goods);
                    that.display();
                    return getDefer().promise;
                }

                var temp = {};
                ids.forEach(function(i) {temp[i] = true;});
                ids = Object.keys(temp);
                ids = "hid in (" + ids.join(",") + ")";
                return D("Taobaohotel").field("hid,hotelid").where(ids).select();
            }).then(function(result) { // think_taobaohotel
                var exists = {};
                result = result || [];
                result.forEach(function(h) {exists[h.hid] = h.hotelid;});
                goods.forEach(function(g, i) {
                    if (exists[g.hid]) {
                        g["goodstatus"] = 1;
                        g["goodstatusicon"] = mapping.goodstatus[1];
                        g["hotelid"] = exists[g.hid];
                    }
                });

                var ids = goods.filter(function(g) {if (g.goodstatus === 1) return true;});
                ids = ids.map(function(g) {return g.rid;});
                if (ids.length === 0) {
                    that.assign("list", goods);
                    that.display();
                    return getDefer().promise;
                }

                ids = "rid in (" + ids.join(",") + ")";
                return D("Room").join("`think_taobaoroom` on `think_taobaoroom`.`roomtypeid` = `think_room`.`roomtypeid`").field("rid,think_room.roomtypeid,no_price_expires").where(ids).select();
            }).then(function(result) { // think_room, think_taobaoroom
                var exists = {};
                result = result || [];
                result.forEach(function(r) {exists[r.rid] = r;});
                goods.forEach(function(g, i) {
                    if (exists[g.rid]) {
                        g["goodstatus"] = 128;
                        g["goodstatusicon"] = "<img src=\"/static/img/icon-yes.gif\" />";
                        g["roomtypeid"] = exists[g.rid]["roomtypeid"];

                        if (exists[g.rid]["no_price_expires"] > Date.now()) {
                            g["goodstatus"] = 3;
                            g["goodstatusicon"] = mapping.goodstatus[3];
                        }
                    }
                });
                that.assign("list", goods);
                that.display();
            });
            return promise;
        },
        inventoryAction: function(sold_out) {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            var message = this.cookie("success.message");
            this.assign("message", message);

            var cookies = [];
            cookies.push(cookie.serialize("success.message", "", {
                path: "/",
                expires: (new Date())
            }));
            cookies.push(cookie.serialize("back.url", req.url, {path: "/"}));
            res.setHeader("Set-Cookie", cookies);

            var range = 0, total = 0;
            var page = parseInt(this.param("p"), 10) || 1;
            var query = this.param("q").trim();
            var formdata = {};
            var params = {
                "cid": 50016161,
                "fields": "num_iid",
                "method": "taobao.items.inventory.get",
                "order_by": "modified:desc",
                "page_no": page,
                "page_size": 20
            };
            if (query.length > 0) {
                formdata["q"] = query;
                params["q"] = query;
            }
            this.assign("formdata", formdata);
            this.assign("tab", "inventory");

            if (sold_out) {
                params["banner"] = "sold_out";
                this.assign("tab", "soldout");
            }

            var goods = [];
            var promise = oauth.accessProtectedResource(req, res, params);
            promise = promise.then(function(result) { // taobao.items.inventory.get
                if (result && result["items_inventory_get_response"]) {
                    total = result["items_inventory_get_response"]["total_results"];
                    result = result["items_inventory_get_response"]["items"];
                    result = result ? result["item"] : [];
                    result = result.map(function(h) {
                        return h.num_iid;
                    });
                } else {
                    result = [];
                }
                if (result.length === 0) return null;

                return oauth.accessProtectedResource(req, res, {
                    "item_ids": result.join(','),
                    "method": "taobao.hotel.rooms.search",
                    "need_hotel": true,
                    "need_room_type": true
                });
            }).then(function(result) { // taobao.hotel.rooms.search
                if (result && result["hotel_rooms_search_response"]) {
                    result = result["hotel_rooms_search_response"]["rooms"];
                    result = result ? (result["room"] || []) : [];
                } else {
                    result = [];
                }
                goods = result;
                range = result.length;

                var qs = querystring.stringify(formdata);
                var pagination = that.pagination(total, range, page, qs, 101);
                that.assign('pagination', pagination);

                var ids = goods.map(function(g, i) {
                    g["goodstatus"] = 0;
                    g["goodstatusicon"] = mapping.goodstatus[0];
                    return g.gid;
                });
                if (ids.length === 0) {
                    that.assign("list", goods);
                    that.display("connect:index");
                    return getDefer().promise;
                }
                return D("Goods").field("gid,status").where("gid in (" + ids.join(",") + ")").select();
            }).then(function(result) { // think_goods
                var exists = {};
                result = result || [];
                result.forEach(function(g) {exists[g.gid] = g.status;});
                goods.forEach(function(g, i) {
                    if (exists[g.gid] && exists[g.gid] == 4) {
                        g["goodstatus"] = 2;
                        g["goodstatusicon"] = mapping.goodstatus[2];
                    }
                });

                var ids = goods.filter(function(g) {if (g.goodstatus === 0) return true;});
                ids = ids.map(function(g) {return g.hid;});
                if (ids.length === 0) {
                    that.assign("list", goods);
                    that.display("connect:index");
                    return getDefer().promise;
                }

                var temp = {};
                ids.forEach(function(i) {temp[i] = true;});
                ids = Object.keys(temp);
                ids = "hid in (" + ids.join(",") + ")";
                return D("Taobaohotel").field("hid,hotelid").where(ids).select();
            }).then(function(result) { // think_taobaohotel
                var exists = {};
                result = result || [];
                result.forEach(function(h) {exists[h.hid] = h.hotelid;});
                goods.forEach(function(g, i) {
                    if (exists[g.hid]) {
                        g["goodstatus"] = 1;
                        g["goodstatusicon"] = mapping.goodstatus[1];
                        g["hotelid"] = exists[g.hid];
                    }
                });

                var ids = goods.filter(function(g) {if (g.goodstatus === 1) return true;});
                ids = ids.map(function(g) {return g.rid;});
                if (ids.length === 0) {
                    that.assign("list", goods);
                    that.display("connect:index");
                    return getDefer().promise;
                }

                ids = "rid in (" + ids.join(",") + ")";
                return D("Room").join("`think_taobaoroom` on `think_taobaoroom`.`roomtypeid` = `think_room`.`roomtypeid`").field("rid,think_room.roomtypeid,no_price_expires").where(ids).select();
            }).then(function(result) { // think_room, think_taobaoroom
                var exists = {};
                result = result || [];
                result.forEach(function(r) {exists[r.rid] = r;});
                goods.forEach(function(g, i) {
                    if (exists[g.rid]) {
                        g["goodstatus"] = 128;
                        g["goodstatusicon"] = "<img src=\"/static/img/icon-yes.gif\" />";
                        g["roomtypeid"] = exists[g.rid]["roomtypeid"];

                        if (exists[g.rid]["no_price_expires"] > Date.now()) {
                            g["goodstatus"] = 3;
                            g["goodstatusicon"] = mapping.goodstatus[3];
                        }
                    }
                });
                that.assign("list", goods);
                that.display("connect:index");
            });
            return promise;
        },
        soldoutAction: function() {
            this.inventoryAction(true);
        },
        editAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            var message = this.cookie("success.message");
            this.assign("message", message);
            res.setHeader("Set-Cookie", cookie.serialize("success.message", "", {
                path: "/",
                expires: (new Date())
            }));

            var gid = this.param("gid");
            var roomtypeid = this.param("roomtypeid");
            if (!gid) {
                this.end(null);
                return null;
            }
            var quotas = this.post('quotas');
            if (quotas) quotas = JSON.parse(quotas);

            var goods;
            return D("Goods").where({gid: gid}).select().then(function(result) {
                goods = result[0];
                if (goods) roomtypeid = goods.roomtypeid;
                if (!quotas) {
                    quotas = {};
                    return Promise.all(that.prices(roomtypeid)).then(function(result) {
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
                    });
                }
            }).then(function(result) {
                var modelroom = D("Room").join("think_hotel on think_hotel.hotelid = think_room.hotelid").field("think_room.original as room,think_hotel.original as hotel").where({
                    'think_room.roomtypeid': roomtypeid
                });

                return Promise.all([oauth.accessProtectedResource(req, res, {
                    "gid": gid,
                    "method": "taobao.hotel.room.get",
                    "need_hotel": true,
                    "need_room_type": true
                }), modelroom.select()]);
            }).then(function(result) {
                var list = {
                    taobao: {},
                    jielv: {}
                };

                var taobao = result[0];
                if (taobao && (taobao = taobao["hotel_room_get_response"]) && (taobao = taobao["room"])) {
                    list.taobao["hotel"] = taobao.hotel.name;
                    list.taobao["room"] = taobao.room_type.name;
                    list.taobao["address"] = taobao.hotel.address;
                    list.taobao["bedtype"] = mapping.bedtypestrings[taobao.bed_type];
                    list.taobao["area"] = mapping.area[taobao.area];
                } else {
                    taobao = {};
                }

                var jielv = result[1][0];
                var bedtype, area;
                jielv.room = JSON.parse(jielv.room);
                jielv.hotel = JSON.parse(jielv.hotel);
                list.jielv["hotel"] = jielv.hotel.namechn;
                list.jielv["room"] = jielv.room.namechn;
                list.jielv["address"] = jielv.hotel.addresschn;

                bedtype = mapping.bedtype[jielv.room.bedtype];
                if (bedtype) list.jielv["bedtype"] = mapping.bedtypestrings[bedtype];

                area = parseInt(jielv.room["acreages"], 10);
                if (area) list.jielv["area"] = area;
                that.assign("list", list);

                var data = {};
                var ratetypes = Object.keys(quotas);
                ratetypes = ratetypes.map(function(rt) {return [rt, (mapping.ratetype[rt] || "其他")];});

                data["gid"] = gid;
                data["roomtypeid"] = roomtypeid;
                data["quotas"] = JSON.stringify(quotas);
                data["action"] = "/connect/save/";
                if (goods && goods.status == 4) {
                    if (ratetypes.length === 0) ratetypes.push([goods.ratetype, (mapping.ratetype[goods.ratetype] || "其他")]);
                    data = extend(data, goods);
                } else {
                    data["hotelid"] = jielv.hotel.hotelid;
                    data["iid"] = taobao.iid;
                    data["ptype"] = 1;
                }

                that.assign("ratetypes", ratetypes);
                that.assign("formdata", data);
                that.display();
            });
        },
        saveAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            if (!this.isPost()) {
                that.end(null);
                return null;
            }

            var quotas = JSON.parse(this.post("quotas"));
            var data = {
                gid: this.post("gid"),
                ptype: this.post("ptype"),
                profit: (parseInt(this.post("profit"), 10) || 0),
                ratetype: this.post("ratetype")
            };
            var hotelid = this.post("hotelid");
            var roomtypeid = this.post("roomtypeid");
            var iid = this.post("iid");

            return D("Goods").where({gid: data.gid}).select().then(function(result) {
                result = result || [];

                var model = D("Goods");
                data.status = 4;
                if (result.length > 0) {
                    model.pk = "gid";
                    return model.update(data);
                } else {
                    data.hotelid = hotelid;
                    data.roomtypeid = roomtypeid;
                    data.iid = iid;
                    data.userid = that.userInfo["taobao_user_id"];
                    return model.add(data);
                }
            }).then(function(result) { // think_goods
                if (result === false) {
                    that.end("关联失败！");
                    return getDefer().promise;
                }

                var content = "关联成功！";
                content += "<a href=\"http://kezhan.trip.taobao.com/item.htm?item_id=";
                content += (iid + "\" target=\"_blank\">去淘宝查看</a>");
                res.setHeader("Set-Cookie", cookie.serialize("success.message", content, {path: "/"}));
                that.redirect(that.cookie("back.url") || "/");

                if (quotas[data.ratetype]) {
                    quotas = quotas[data.ratetype];

                    var roomQuota = [];
                    var timestamp = Date.now();
                    var night, price;
                    var i = 0;
                    for (; i < 90; i += 1) {
                        night = dateformat(timestamp, "yyyy-mm-dd");
                        timestamp += 24 * 60 * 60 * 1000;
                        price = quotas[night];
                        if (price) {
                            num = price.num;
                            price = price.price;
                            if (data.ptype == 1) price = Math.ceil(price * (data.profit + 100) / 100) * 100;
                            else if (data.ptype == 2) price = Math.ceil((price + data.profit)) * 100;
                            roomQuota.push({
                                date: night,
                                price: price,
                                num: num
                            });
                        } else {
                            roomQuota.push({
                                date: night,
                                price: 9999999,
                                num: 0
                            });
                        }
                    }
                    return oauth.accessProtectedResource(req, res, {
                        "method": "taobao.hotel.room.update",
                        "gid": data.gid,
                        "room_quotas": JSON.stringify(roomQuota),
                        "status": 1
                    });
                } else {
                    return oauth.accessProtectedResource(req, res, {
                        "method": "taobao.hotel.room.update",
                        "gid": data.gid,
                        "status": 2
                    });
                }
            }).then(function(result) { // taobao.hotel.room.update
                if (result && (result = result["hotel_room_update_response"]) && (result = result["room"])) {
                    var time = "[" + result.modified + "]";
                    if (result.status == 2) console.log(time, "taobao.hotel.room.update(delisting)", result.gid);
                    else if (result.status == 1) console.log(time, "taobao.hotel.room.update", result.gid);
                }
            });
        },
        deleteAction: function() {
            var that = this;
            var gid = this.post("gid");

            if (!gid) {
                this.end(null);
                return null;
            }

            return D("Goods").where({gid: gid})["delete"]().then(function(result) {
                if (result === false) {
                    that.end(null);
                    return null;
                }
                that.end({success: 1});
            });
        },
        matchAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            var gid = this.param("gid");
            var hotelid = parseInt(this.param("hotelid"), 10);
            var query = this.param("q").trim();
            var formdata = {};

            if (!gid) {
                this.end(null);
                return null;
            }

            var range = 0, total = 0;
            var page = parseInt(this.param("p"), 10) || 1;

            var model1, model2;
            var troom = oauth.accessProtectedResource(req, res, {
                "gid": gid,
                "method": "taobao.hotel.room.get",
                "need_hotel": true,
                "need_room_type": true
            }).then(function(result) {
                result = result["hotel_room_get_response"]["room"];

                that.assign("taobao", {
                    hotel: result.hotel.name,
                    room: result.room_type.name,
                    address: result.hotel.address,
                    bedtype: mapping.bedtypestrings[result.bed_type],
                    area: mapping.area[result.area]
                });
            });

            if (hotelid) {
                model1 = D("Hotel").where("hotelid=" + hotelid).select();
                model2 = Promise.resolve(1);
                formdata["hotelid"] = hotelid;
            } else {
                model1 = D("Hotel");
                model2 = D("Hotel");

                if (query.length > 0) {
                    formdata["q"] = query;
                    model1 = model1.where("namechn like '%" + query + "%'");
                    model2 = model2.where("namechn like '%" + query + "%'");
                }
                model1 = model1.page(page).select();
                model2 = model2.count();
            }
            formdata["gid"] = gid;
            this.assign("formdata", formdata);

            model1 = model1.then(function(result) {
                result = result || [];
                var rids = [];
                var data = result.map(function(h) {
                    var original = JSON.parse(h.original);
                    original["namechn"] = h.namechn;
                    original["website"] = h.website;
                    original.rooms.forEach(function(r) {
                        var bedtype = mapping.bedtype[r.bedtype] || "B";
                        var area = parseInt(r["acreages"].replace(/^\D/, ""), 10) || 20;
                        rids.push(r.roomtypeid);
                        r.bedtype = mapping.bedtypestrings[bedtype];
                        r.area = area;
                    });
                    return original;
                });

                range = data.length;
                that.assign("list", data);
                if (rids.length === 0) return [];
                return D("Room").field("roomtypeid,no_price_expires").where("roomtypeid in (" + rids.join(",") + ")").select();
            }).then(function(result) {
                result = result || [];

                var roomstatus = {};
                result.forEach(function(r) {
                    if (r.no_price_expires > Date.now()) roomstatus[r.roomtypeid] = {
                        status: 5,
                        icon: mapping.roomstatus[5]
                    };
                });
                that.assign("roomstatus", roomstatus);
            });
            model2 = model2.then(function(result) {total = result || 0;});

            return Promise.all([troom, model1, model2]).then(function(result) {
                var qs = querystring.stringify(formdata);
                var pagination = that.pagination(total, range, page, qs);
                that.assign('pagination', pagination);
                that.display();
            });
        }
    };
});
