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
        inquiryAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            if (this.isPost()) {
                var roomtypeid = this.post("roomtypeid");
                if (!roomtypeid) {
                    this.end(null);
                    return null;
                }

                return Promise.all(this.prices(roomtypeid)).then(function(result) {
                    var data = [];
                    if (result[0] && result[0].success == 1) data.push(result[0].data);
                    if (result[1] && result[1].success == 1) data.push(result[1].data);
                    if (result[2] && result[2].success == 1) data.push(result[2].data);
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

                    var rpd = [];
                    data.forEach(function(period) {
                        if (period[0].roomPriceDetail) rpd = rpd.concat(period[0].roomPriceDetail);
                    });
                    data[0][0]["roomPriceDetail"] = rpd;
                    that.end(data[0][0]);
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
                var promises = [],
                    model;

                model = D("Room").field("original").where({"roomtypeid": data.roomtypeId}).select();
                promises.push(model);
                model = D("Taobaoroom").where({"roomtypeid": data.roomtypeId}).order("rid desc").select();
                promises.push(model);
                model = D("User").field("pic_path,guide");
                model = model.where("id = " + that.userInfo["taobao_user_id"]).select();
                promises.push(model);

                return Promise.all(promises).then(function(result) { // think_room, think_taobaoroom, think_user
                    var room = result[0][0];
                    var taobaoroom = result[1][0];
                    var usermeta = result[2][0];

                    var original = JSON.parse(room["original"]);
                    var detail = data.roomPriceDetail[0];

                    var title = data.hotelName + " " + data.roomtypeName;

                    var area = parseInt(original["acreages"].replace(/^\D/, ""), 10) || 20;
                    if (area <= 15) area = "A";
                    else if (area > 15 && area <= 30) area = "B";
                    else if (area > 30 && area <= 50) area = "C";
                    else area = "D";

                    var size = parseFloat(original["bedsize"].replace(/^\D/, "")) || 1.5;
                    if (size <= 1) size = "A";
                    else if (size > 2.2) size = "H";
                    else if (mapping.bedsize[size]) size = mapping.bedsize[size];
                    else size = "E";

                    var bedtype = mapping.bedtype[original.bedtype] || "B";
                    var storey = parseInt(original["floordistribution"].replace(/^\D/, ""), 10) || 3;

                    var breakfast = "A";
                    if (detail.ratetype == 16 || detail.ratetype == 56) breakfast = "B";
                    else if (detail.ratetype == 9) breakfast = "C";

                    var bbn = "A";
                    if (detail["internetprice"] != 3 && detail["netcharge"] === 0) bbn = "B";
                    else if (detail["internetprice"] != 3 && detail["netcharge"] !== 0) bbn = "C";

                    var quotas = {};
                    var night = dateformat(Date.now(), "");
                    quotas[night] = {
                        date: night,
                        price: 9999999,
                        num: 0
                    };

                    var params = {
                        "method": "taobao.hotel.room.add",
                        "hid": taobaoroom.hid,
                        "rid": taobaoroom.rid,
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
                        "has_receipt": false, // TODO
                        "refund_policy_info": JSON.stringify({t: 2}) // TODO
                    };

                    if (usermeta.pic_path) {
                        temp = usermeta.pic_path.split("/");
                        i = "/" + temp.pop();
                        i = "/" + temp.pop() + i;
                        i = temp.pop() + i;
                        params["pic_path"] = i;
                    } else {
                        params["pic"] = __dirname + "/../../../../www/static/img/placeholder.jpg";
                    }

                    if (usermeta.guide) params["guide"] = usermeta.guide;
                    return oauth.accessProtectedResource(req, res, params);
                }).then(function(result) { // taobao.hotel.room.add
                    var message = "暂无价格！";

                    if (!result || (result && result["error_response"])) {
                        if (resul && result["error_response"]) message = result["error_response"]["sub_msg"];
                        that.end({
                            success: 8,
                            message: message
                        });
                        return getDefer().promise;
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
            } else {
                this.end(null);
            }
        }
    };
});
