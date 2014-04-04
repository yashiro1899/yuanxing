/**
 * controller
 * @return
 */
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
            promise = promise.then(function(result) {
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
            }).then(function(result) {
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
                    goods[i]["goodstatus"] = 0;
                    goods[i]["goodstatusicon"] = mapping.goodstatus[0];
                    return g.gid;
                });
                if (ids.length === 0) {
                    that.assign("list", goods);
                    that.display();
                    return getDefer().promise;
                }
                return D("Goods").field("gid,status").where("gid in (" + ids.join(",") + ")").select();
            }).then(function(result) {
                var exists = {};
                result = result || [];
                result.forEach(function(g) {exists[g.gid] = g.status;});
                goods.forEach(function(g, i) {
                    if (exists[g.gid] && exists[g.gid] == 4) {
                        goods[i]["goodstatus"] = 2;
                        goods[i]["goodstatusicon"] = mapping.goodstatus[2];
                    }
                });

                var ids = goods.filter(function(g) {if (g.goodstatus === 0) return true;});
                ids = ids.map(function(g) {return g.hid;});
                if (ids.length === 0) {
                    that.assign("list", goods);
                    that.display();
                    return getDefer().promise;
                }
                ids = "taobao_hid in (" + ids.join(",") + ")";
                return D("Hotel").field("hotelid,taobao_hid").where(ids).select();
            }).then(function(result) {
                var exists = {};
                result = result || [];
                result.forEach(function(h) {exists[h.taobao_hid] = h.hotelid;});
                goods.forEach(function(g, i) {
                    if (exists[g.hid]) {
                        goods[i]["goodstatus"] = 1;
                        goods[i]["goodstatusicon"] = mapping.goodstatus[1];
                        goods[i]["hotelid"] = exists[g.hid];
                    }
                });

                var ids = goods.filter(function(g) {if (g.goodstatus === 1) return true;});
                ids = ids.map(function(g) {return g.rid;});
                if (ids.length === 0) {
                    that.assign("list", goods);
                    that.display();
                    return getDefer().promise;
                }
                ids = "taobao_rid in (" + ids.join(",") + ")";
                return D("Room").field("roomtypeid,taobao_rid").where(ids).select();
            }).then(function(result) {
                var exists = {};
                result = result || [];
                result.forEach(function(r) {exists[r.taobao_rid] = r.roomtypeid;});
                goods.forEach(function(g, i) {
                    if (exists[g.rid]) {
                        goods[i]["goodstatus"] = 128;
                        goods[i]["goodstatusicon"] = "<img src=\"/static/img/icon-yes.gif\" />";
                        goods[i]["roomtypeid"] = exists[g.rid];
                    }
                });
                that.assign("list", goods);
                that.display();
            });

            return promise;
        },
        inventoryAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

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

            var goods = [];
            var promise = oauth.accessProtectedResource(req, res, params);
            promise = promise.then(function(result) {
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
            }).then(function(result) {
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
                    goods[i]["goodstatus"] = 0;
                    goods[i]["goodstatusicon"] = mapping.goodstatus[0];
                    return g.gid;
                });
                if (ids.length === 0) {
                    that.assign("list", goods);
                    that.display("connect:index");
                    return getDefer().promise;
                }
                return D("Goods").field("gid,status").where("gid in (" + ids.join(",") + ")").select();
            }).then(function(result) {
                var exists = {};
                result = result || [];
                result.forEach(function(g) {exists[g.gid] = g.status;});
                goods.forEach(function(g, i) {
                    if (exists[g.gid] && exists[g.gid] == 4) {
                        goods[i]["goodstatus"] = 2;
                        goods[i]["goodstatusicon"] = mapping.goodstatus[2];
                    }
                });

                var ids = goods.filter(function(g) {if (g.goodstatus === 0) return true;});
                ids = ids.map(function(g) {return g.hid;});
                if (ids.length === 0) {
                    that.assign("list", goods);
                    that.display("connect:index");
                    return getDefer().promise;
                }
                ids = "taobao_hid in (" + ids.join(",") + ")";
                return D("Hotel").field("hotelid,taobao_hid").where(ids).select();
            }).then(function(result) {
                var exists = {};
                result = result || [];
                result.forEach(function(h) {exists[h.taobao_hid] = h.hotelid;});
                goods.forEach(function(g, i) {
                    if (exists[g.hid]) {
                        goods[i]["goodstatus"] = 1;
                        goods[i]["goodstatusicon"] = mapping.goodstatus[1];
                        goods[i]["hotelid"] = exists[g.hid];
                    }
                });

                var ids = goods.filter(function(g) {if (g.goodstatus === 1) return true;});
                ids = ids.map(function(g) {return g.rid;});
                if (ids.length === 0) {
                    that.assign("list", goods);
                    that.display("connect:index");
                    return getDefer().promise;
                }
                ids = "taobao_rid in (" + ids.join(",") + ")";
                return D("Room").field("roomtypeid,taobao_rid").where(ids).select();
            }).then(function(result) {
                var exists = {};
                result = result || [];
                result.forEach(function(r) {exists[r.taobao_rid] = r.roomtypeid;});
                goods.forEach(function(g, i) {
                    if (exists[g.rid]) {
                        goods[i]["goodstatus"] = 128;
                        goods[i]["goodstatusicon"] = "<img src=\"/static/img/icon-yes.gif\" />";
                        goods[i]["roomtypeid"] = exists[g.rid];
                    }
                });
                that.assign("list", goods);
                that.display("connect:index");
            });

            return promise;
        },
        createAction: function() {
            var that = this;
            var req = this.http.req;
            var res = this.http.res;

            if (this.isPost()) {
                var data = this.post("data");
                var gid = this.post("gid");
                var roomtypeid = this.post("roomtypeid");

                if (!data || !gid || !roomtypeid) {
                    this.end(null);
                    return null;
                }
                try {
                    data = JSON.parse(data);
                } catch(e) {
                    this.end(null);
                    return null;
                }

                var promises = [];
                var model;
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
                    that.end('<pre>' + JSON.stringify(result, null, 4) + '</pre>');
                });
            } else {
                this.end(null);
            }
        }
    };
});
