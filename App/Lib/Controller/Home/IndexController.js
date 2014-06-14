/**
 * controller
 * @return
 */
var cookie = require("cookie");
var dateformat = require("dateformat");
var mapping = require("../../../../define.conf");
var oauth = require("../../../../taobao-oauth");
var querystring = require('querystring');
module.exports = Controller("Home/BaseController", function() {
    return {
        navType: "tasks",
        title: "记录",
        indexAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            var message = this.cookie("success.message");
            var now = new Date();
            this.assign("message", message);
            res.setHeader("Set-Cookie", cookie.serialize("success.message", "", {
                path: "/",
                expires: now
            }));
            res.setHeader("Set-Cookie", cookie.serialize("back.url", req.url, {
                path: "/",
                expires: (new Date(24 * 60 * 60 * 1000 + now))
            }));

            var page = parseInt(this.param("p"), 10) || 1;
            var query = this.param("q").trim();
            var formdata = {};

            var promise, data;
            if (query.length > 0) {
                formdata["q"] = query;
                promise = D("Hotel").field("hotelid").where("namechn like '%" + query + "%'").select();
                promise = promise.then(function(result) {
                    result = result || [];
                    var ids = result.map(function(h) {return h.hotelid;});
                    var model1 = D("Goods");
                    var model2 = D("Goods");

                    if (ids.length > 0) {
                        ids = " and hotelid in (" + ids.join(",") + ")";
                        ids = "userid = " + that.userInfo["taobao_user_id"] + ids;
                        model1 = model1.where(ids);
                        model2 = model2.where(ids);
                    } else {
                        return [null, null];
                    }

                    model1 = model1.order("updated_at desc").page(page).select();
                    model2 = model2.count();
                    return Promise.all([model1, model2]);
                });
            }
            if (!promise) {
                promise = "userid = " + that.userInfo["taobao_user_id"];
                model1 = D("Goods").where(promise).order("updated_at desc").page(page).select();
                model2 = D("Goods").where(promise).count();
                promise = Promise.all([model1, model2]);
            }
            this.assign("formdata", formdata);

            promise = promise.then(function(result) { // think_goods
                var gids = [];
                var rids = [];
                data = result[0] || [];
                data.forEach(function(i) {
                    gids.push(i.gid);
                    rids.push(i.roomtypeid);
                });

                var range = data.length;
                var total = result[1] || 0;
                var qs = querystring.stringify(formdata);
                var pagination = that.pagination(total, range, page, qs);
                that.assign('pagination', pagination);

                var promise1, promise2;
                if (gids.length === 0) promise1 = Promise.resolve([]);
                else promise1 = oauth.accessProtectedResource(req, res, {
                    "gids": gids.join(','),
                    "method": "taobao.hotel.rooms.search",
                    "need_hotel": true,
                    "need_room_type": true
                });
                if (rids.length === 0) promise2 = Promise.resolve([]);
                else {
                    promise2 = D("Hotel").join("`think_room` on `think_room`.`hotelid` = `think_hotel`.`hotelid`");
                    promise2 = promise2.field("think_hotel.original as h,think_room.original as r,think_room.roomtypeid");
                    promise2 = promise2.where("think_room.roomtypeid in (" + rids.join(",") + ")").select();
                }

                return Promise.all([promise1, promise2]);
            }).then(function(result) { // taobao.hotel.rooms.search, think_hotel, think_room
                var taobao = {};
                var jielv = {};
                var temp;

                if (result[0] && result[0]["hotel_rooms_search_response"]) {
                    temp = result[0]["hotel_rooms_search_response"]["rooms"];
                    temp = temp ? temp["room"] : [];
                    temp.forEach(function(i) {taobao[i.gid] = i;});
                }
                temp = result[1] || [];
                temp.forEach(function(i) {
                    try {
                        jielv[i.roomtypeid] = {
                            hotel: JSON.parse(i.h),
                            room: JSON.parse(i.r)
                        };
                    } catch(e) {console.log(e);}
                });

                data.forEach(function(v, i) {
                    var t = taobao[v.gid];
                    var j = jielv[v.roomtypeid];

                    if (t) {
                        data[i]["taobaohotel"] = t.hotel.name;
                        data[i]["taobaoroomtype"] = t.room_type.name;
                        data[i]["taobaoaddress"] = t.hotel.address;
                    }
                    if (j) {
                        data[i]["jielvhotel"] = j.hotel.namechn;
                        data[i]["jielvroomtype"] = j.room.namechn;
                        data[i]["jielvaddress"] = j.hotel.addresschn;
                    }

                    data[i]["updated_at"] = dateformat(v.updated_at, "yyyy-mm-dd HH:MM");
                    data[i]["typeicon"] = mapping.roomstatus[v.status];
                    if (v.status == 4) {
                        data[i]["typeicon"] = '<input class="action-select" type="checkbox" value="' + v.gid + '" />';
                        data[i]["ratetypestring"] = (mapping.ratetype[v.ratetype] || "其他");
                        data[i]["ptypestring"] = mapping.ptypestrings[v.ptype];
                        data[i]["profit"] = (v.ptype == 1 ? v.profit + "%" : v.profit.toFixed(2));
                    }
                });
                that.assign("list", data);
                that.display();
            });
            return promise;
        }
    };
});
