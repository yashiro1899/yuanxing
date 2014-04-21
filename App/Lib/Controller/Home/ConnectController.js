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
        navType: "connect",
        title: "关联",
        indexAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            var message = this.cookie("success.message");
            var now = new Date();
            this.assign("message", message);
            this.http.res.setHeader("Set-Cookie", cookie.serialize("success.message", "", {
                path: "/",
                expires: now
            }));

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
                            g["goodstatus"] = 4;
                            g["goodstatusicon"] = mapping.goodstatus[4];
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

            this.assign("message", null);

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
        createAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            var message = this.cookie("success.message");
            var now = new Date();
            this.assign("message", message);
            this.http.res.setHeader("Set-Cookie", cookie.serialize("success.message", "", {
                path: "/",
                expires: now
            }));

            if (this.isPost()) {
                var data = this.post("data");
                var gid = this.post("gid");
                var roomtypeid = this.post("roomtypeid");
                var formdata = {};
                formdata["data"] = data;
                formdata["gid"] = gid;
                formdata["roomtypeid"] = roomtypeid;

                data = JSON.parse(data);
                var model;
                var action = this.post("action");
                if (action == "create") { // insert into db
                    var hotelid = this.post("hotelid");
                    var iid = this.post("iid");
                    var ratetype = this.post("ratetype");
                    var ptype = this.post("ptype");
                    var profit = parseInt(this.post("profit"), 10) || 0;

                    model = D("Goods").where({gid: gid}).select();
                    model = model.then(function(result) {
                        result = result || [];

                        if (result.length > 0) {
                            var g = D("Goods");
                            g.pk = "gid";
                            return g.update({
                                gid: gid,
                                status: 4,
                                ratetype: ratetype,
                                ptype: ptype,
                                profit: profit
                            });
                        } else {
                            return D("Goods").add({
                                gid: gid,
                                userid: that.userInfo["taobao_user_id"],
                                hotelid: hotelid,
                                roomtypeid: roomtypeid,
                                status: 4,
                                iid: iid,
                                ratetype: ratetype,
                                ptype: ptype,
                                profit: profit
                            });
                        }
                    }).then(function(result) { // think_goods
                        if (result === false) {
                            that.end("关联失败！");
                            return getDefer().promise;
                        }
                        var now = +(new Date());
                        var content = "关联成功！";
                        content += "<a href=\"http://kezhan.trip.taobao.com/item.htm?item_id=";
                        content += (iid + "\" target=\"_blank\">去淘宝查看</a>");
                        res.setHeader("Set-Cookie", cookie.serialize("success.message", content, {
                            path: "/",
                            expires: (new Date(24 * 60 * 60 * 1000 + now))
                        }));
                        that.redirect("/");

                        var quotas = {};
                        data.roomPriceDetail.forEach(function(rpd) {
                            var night = dateformat((new Date(rpd.night)), "yyyy-mm-dd");
                            var price = rpd.preeprice;
                            profit = parseInt(profit, 10) || 0;
                            if (rpd.ratetype != ratetype) return null;
                            if (ptype == 1) price = Math.ceil(price * (profit + 100) / 100) * 100;
                            else if (ptype == 2) price = Math.ceil((price + profit)) * 100;

                            quotas[night] = {
                                date: night,
                                price: price,
                                num: rpd.qtyable
                            };
                        });
                        var temp = [], i;
                        for (i in quotas) temp.push(quotas[i]);
                        quotas = temp;

                        return oauth.accessProtectedResource(req, res, {
                            "method": "taobao.hotel.room.update",
                            "gid": gid,
                            "room_quotas": JSON.stringify(quotas),
                            "status": 2 // TODO: LISTING
                        });
                    }).then(function(result) {
                        console.log(result);
                    });
                    return model;
                }

                var ratetypes = {};
                data.roomPriceDetail.forEach(function(rpd) {ratetypes[rpd.ratetype] = true;});
                ratetypes = Object.keys(ratetypes);
                ratetypes = ratetypes.map(function(rt) {
                    return [rt, mapping.ratetype[rt]];
                });
                this.assign("ratetypes", ratetypes);

                var promises = [];
                promises.push(oauth.accessProtectedResource(req, res, {
                    "gid": gid,
                    "method": "taobao.hotel.room.get",
                    "need_hotel": true,
                    "need_room_type": true
                }));
                model = D("Hotel").join("`think_room` on `think_room`.`hotelid` = `think_hotel`.`hotelid`");
                model = model.field("think_hotel.original as h,think_room.original as r");
                model = model.where({"think_room.roomtypeid": roomtypeid}).select();
                promises.push(model);
                return Promise.all(promises).then(function(result) {
                    var taobao = result[0]["hotel_room_get_response"]["room"];
                    var jielv = result[1][0];
                    var jielvhotel = JSON.parse(jielv.h);
                    var jielvroom = JSON.parse(jielv.r);
                    var jielvbedtype = mapping.bedtype[jielvroom.bedtype] || "B";
                    var jielvarea = parseInt(jielvroom["acreages"].replace(/^\D/, ""), 10) || 20;
                    var list = {};

                    list["taobao"] = {
                        hotel: taobao.hotel.name,
                        room: taobao.room_type.name,
                        address: taobao.hotel.address,
                        bedtype: mapping.bedtypestrings[taobao.bed_type],
                        area: mapping.area[taobao.area]
                    };
                    list["jielv"] = {
                        hotel: jielvhotel.namechn,
                        room: jielvroom.namechn,
                        address: jielvhotel.addresschn,
                        bedtype: mapping.bedtypestrings[jielvbedtype],
                        area: jielvarea
                    };

                    formdata["iid"] = taobao.iid;
                    formdata["hotelid"] = jielvhotel.hotelid;
                    formdata["ptype"] = 1;
                    that.assign("formdata", formdata);
                    that.assign("list", list);
                    that.display();
                });
            } else {
                this.redirect("/connect/");
            }
        },
        updateAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            var gid = this.param("gid");
            if (!gid) {
                this.redirect("/");
                return null;
            }
            var promise, data;
            this.assign("message", "");

            if (this.isPost()) {
                promise = D("Goods");
                promise.pk = "gid";
                promise = promise.update({
                    gid: gid,
                    ratetype: this.post("ratetype"),
                    ptype: this.post("ptype"),
                    profit: (parseInt(this.post("profit"), 10) || 0)
                }).then(function(result) {
                    if (result === false) {
                        that.end("编辑失败！");
                        return getDefer().promise;
                    }

                    var now = +(new Date());
                    var content = "编辑成功！";
                    content += "<a href=\"http://kezhan.trip.taobao.com/item.htm?item_id=";
                    content += (that.post("iid") + "\" target=\"_blank\">去淘宝查看</a>");
                    res.setHeader("Set-Cookie", cookie.serialize("success.message", content, {
                        path: "/",
                        expires: (new Date(24 * 60 * 60 * 1000 + now))
                    }));
                    that.redirect("/");

                    data = JSON.parse(that.post("data"));
                    var ratetype = that.post("ratetype");
                    var ptype = that.post("ptype");
                    var profit = parseInt(that.post("profit"), 10) || 0;
                    var quotas = {};
                    data.roomPriceDetail.forEach(function(rpd) {
                        var night = dateformat((new Date(rpd.night)), "yyyy-mm-dd");
                        var price = rpd.preeprice;
                        profit = parseInt(profit, 10) || 0;
                        if (rpd.ratetype != ratetype) return null;
                        if (ptype == 1) price = Math.ceil(price * (profit + 100) / 100) * 100;
                        else if (ptype == 2) price = Math.ceil((price + profit)) * 100;

                        quotas[night] = {
                            date: night,
                            price: price,
                            num: rpd.qtyable
                        };
                    });
                    var temp = [], i;
                    for (i in quotas) temp.push(quotas[i]);
                    quotas = temp;

                    return oauth.accessProtectedResource(req, res, {
                        "method": "taobao.hotel.room.update",
                        "gid": gid,
                        "room_quotas": JSON.stringify(quotas),
                        "status": 2 // TODO: LISTING
                    });
                }).then(function(result) {
                    console.log(result);
                });
            } else {
                promise = D("Goods").where({gid: gid}).select();
                promise = promise.then(function(result) {
                    data = result[0];

                    var promises = [];
                    var model, start, end;
                    promises.push(oauth.accessProtectedResource(req, res, {
                        "gid": gid,
                        "method": "taobao.hotel.room.get",
                        "need_hotel": true,
                        "need_room_type": true
                    }));

                    model = D("Hotel").join("`think_room` on `think_room`.`hotelid` = `think_hotel`.`hotelid`");
                    model = model.field("think_hotel.original as h,think_room.original as r");
                    model = model.where({"think_room.roomtypeid": data.roomtypeid}).select();
                    promises.push(model);

                    start = +(new Date());
                    end = start + 30 * 24 * 60 * 60 * 1000;
                    start = new Date(start);
                    end = new Date(end);
                    start = dateformat(start, "yyyy-mm-dd");
                    end = dateformat(end, "yyyy-mm-dd");
                    promises.push(jielvapi({
                        "QueryType": "hotelpriceall",
                        "roomtypeids": data.roomtypeid,
                        "checkInDate": start,
                        "checkOutDate": end
                    }));
                    return Promise.all(promises);
                }).then(function(result) {
                    var taobao = result[0]["hotel_room_get_response"]["room"];
                    var jielv = result[1][0];
                    var jielvhotel = JSON.parse(jielv.h);
                    var jielvroom = JSON.parse(jielv.r);
                    var jielvbedtype = mapping.bedtype[jielvroom.bedtype] || "B";
                    var jielvarea = parseInt(jielvroom["acreages"].replace(/^\D/, ""), 10) || 20;
                    var list = {};
                    list["taobao"] = {
                        hotel: taobao.hotel.name,
                        room: taobao.room_type.name,
                        address: taobao.hotel.address,
                        bedtype: mapping.bedtypestrings[taobao.bed_type],
                        area: mapping.area[taobao.area]
                    };
                    list["jielv"] = {
                        hotel: jielvhotel.namechn,
                        room: jielvroom.namechn,
                        address: jielvhotel.addresschn,
                        bedtype: mapping.bedtypestrings[jielvbedtype],
                        area: jielvarea
                    };
                    that.assign("list", list);

                    var ratetypes = {};
                    result[2]["data"][0].roomPriceDetail.forEach(function(rpd) {ratetypes[rpd.ratetype] = true;});
                    ratetypes = Object.keys(ratetypes);
                    ratetypes = ratetypes.map(function(rt) {
                        return [rt, mapping.ratetype[rt]];
                    });
                    if (ratetypes.length === 0) ratetypes.push([data.ratetype, mapping.ratetypes[data.ratetype]]);
                    that.assign("ratetypes", ratetypes);

                    data["data"] = JSON.stringify(result[2]["data"][0]);
                    that.assign("formdata", data);
                    that.display("connect:create");
                });
            }
            return promise;
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

            var gid = this.post("gid");
            var hotelid = parseInt(this.param("hotelid"), 10);
            var query = this.param("q").trim();

            var range = 0, total = 0;
            var page = parseInt(this.param("p"), 10) || 1;

            var model1, model2;
            var troom = oauth.accessProtectedResource(req, res, {
                "gid": gid,
                "method": "taobao.hotel.room.get",
                "need_hotel": true,
                "need_room_type": true
            });

            if (hotelid) {
                model1 = D("Hotel").where("hotelid=" + hotelid).select();
                model2 = Promise.resolve(1);
            } else {
                model1 = D("Hotel").where("namechn like '%" + query + "%'").select();
                model2 = D("Hotel").where("namechn like '%" + query + "%'").count();
            }

            return Promise.all([troom, model1, model2]).then(function(result) {
                // var taobao = result[0]["hotel_room_get_response"]["room"];

                // that.assign("taobao", {
                //     hotel: result.hotel.name,
                //     room: result.room_type.name,
                //     address: result.hotel.address,
                //     bedtype: mapping.bedtypestrings[result.bed_type],
                //     area: mapping.area[result.area]
                // });

                that.assign("taobao", {
                    hotel: "深圳阳光酒店",
                    room: "豪单",
                    address: "深圳市罗湖区嘉宾路1号",
                    bedtype: "大床",
                    area: "16 - 30"
                });

                that.display();
            });
        }
    };
});
