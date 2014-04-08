/**
 * controller
 * @return
 */
var cookie = require("cookie");
var dateformat = require("dateformat");
var mapping = require("../../../../define.conf");
var oauth = require("../../../../taobao-oauth");
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
            this.http.res.setHeader("Set-Cookie", cookie.serialize("success.message", "", {
                path: "/",
                expires: now
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
                    var model = D("Goods");
                    if (ids.length > 0) model = model.where("hotelid in (" + ids.join(",") + ")");
                    return model.order("updated_at desc").page(page).select();
                });
            }
            if (!promise) promise = D("Goods").order("updated_at desc").page(page).select();
            this.assign("formdata", formdata);

            promise = promise.then(function(result) {
                result = result || [];

                var gids = [];
                var rids = [];
                data = result;
                result.forEach(function(i) {
                    gids.push(i.gid);
                    rids.push(i.roomtypeid);
                });

                var promises = [];
                var model;
                if (gids.length === 0) promises[0] = Promise.all([]);
                else promises[0] = oauth.accessProtectedResource(req, res, {
                    "gids": gids.join(','),
                    "method": "taobao.hotel.rooms.search",
                    "need_hotel": true,
                    "need_room_type": true
                });
                if (rids.length === 0) promises[1] = Promise.all([]);
                else {
                    model = D("Hotel").join("`think_room` on `think_room`.`hotelid` = `think_hotel`.`hotelid`");
                    model = model.field("think_hotel.original as h,think_room.original as r,think_room.roomtypeid");
                    model = model.where("think_room.roomtypeid in (" + rids.join(",") + ")").select();
                    promises[1] = model;
                }

                return Promise.all(promises);
            }).then(function(result) {
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
                        data[i]["ratetypestring"] = mapping.ratetype[v.ratetype];
                        data[i]["ptypestring"] = mapping.ptypestrings[v.ptype];
                        data[i]["profit"] = v.profit.toFixed(2);
                    }
                });
                that.assign("list", data);
                that.display();
                // that.end("<pre>" + JSON.stringify(data, null, 4) + "</pre>");
            });
            return promise;
        }
    };
});
