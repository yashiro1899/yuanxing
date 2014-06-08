process.on('message', function(data) {
var roomtypeids = data.roomtypeids;
var users = data.users;

var Agent = require("agentkeepalive");
var Bagpipe = require('bagpipe');
var conf = require('../auth.conf');
var dateformat = require("dateformat");
var http = require('http');
var https = require('https');
var mysql = require('mysql');
var Promise = require('es6-promise').Promise;
var util = require("util");

var getDefer = function() {
    var deferred = {};
    deferred.promise = new Promise(function(resolve, reject) {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });
    return deferred;
};
var connection = mysql.createConnection(conf.mysql);
connection.connect();

var host = conf.jielv["host"] || "chstravel.com";
var port = conf.jielv["port"] || "30000";
var jielvOptions = {
    host: host,
    port: port,
    path: "/commonQueryServlet",
    method: "POST",
    agent: (new Agent({
        maxSockets: 50,
        keepAlive: true
    })),
    headers: {
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Host": host + ":" + port,
        "Content-Length": 0
    }
};
var taobaoOptions = {
    host: "eco.taobao.com",
    port: null,
    path: "/router/rest",
    method: "POST",
    headers: {
        "Host": "eco.taobao.com",
        "Content-Type": "",
        "Content-Length": 0
    }
};

var bagpipe = new Bagpipe(50);
var length = Math.ceil(roomtypeids.length / 20);
var i = 0;
var start, end, j;

var deferred = getDefer();
var quotas = {};
var count = length * 3;
var callback = function(result) {
    if (result && result.data && result.data.length) {
        result.data.forEach(function(room) {
            var id = room.roomtypeId;
            if (!quotas[id]) quotas[id] = {};

            room.roomPriceDetail.forEach(function(rpd) {
                if (rpd.qtyable < 1) return null;
                var type = rpd.ratetype;
                var night, price;

                if (!quotas[id][type]) quotas[id][type] = {};
                night = dateformat((new Date(rpd.night)), "yyyy-mm-dd");
                price = quotas[id][type][night];
                if (price && price.price < rpd.preeprice) return null;

                quotas[id][type][night] = {
                    price: rpd.preeprice,
                    num: rpd.qtyable
                };
            });
        });
    }
    count -= 1;

    if (count === 0) {
        deferred.resolve(null);
    }
};

for (; i < length; i += 1) {
    start = Date.now();
    end = start + 30 * 24 * 60 * 60 * 1000;

    for (j = 0; j < 3; j += 1) {
        bagpipe.push(jielvrequest, {
            "QueryType": "hotelpriceall",
            "roomtypeids": roomtypeids.slice(i * 20, (i + 1) * 20).join("/"),
            "checkInDate": dateformat(start, "yyyy-mm-dd"),
            "checkOutDate": dateformat(end, "yyyy-mm-dd")
        }, callback);

        start = end;
        end = start + 30 * 24 * 60 * 60 * 1000;
    }
}

var goods = {};
deferred.promise.then(function(result) { // hotelpriceall
    var dfd = getDefer();
    var querystring = "select gid,userid,roomtypeid,ratetype,ptype,profit from think_goods where roomtypeid in (" + roomtypeids.join(",") + ") and userid in (" + Object.keys(users).join(",") + ") and status = 4";
    roomtypeids = null;
    connection.query(querystring, function(err, rows, fields) {
        if (err) {
            console.log(err.toString());
            rows = [];
        }
        dfd.resolve(rows);
    });
    return dfd.promise;
}).then(function(result) { // think_goods
    connection.end();
    var length = result.length;
    if (length === 0) process.exit(0);

    var i = 0, g, userid;
    for (; i < length; i += 1) {
        g = result[i];
        userid = g.userid;
        delete g.userid;

        if (goods[userid] === undefined) goods[userid] = [];
        goods[userid].push(g);
    }

    var dfd = getDefer();
    bagpipe = new Bagpipe(50);
    count = 0;
    callback = function(result) {
        console.log(result);
        count -= 1;

        if (count === 0) {
            process.exit(0);
            // dfd.resolve(null);
        }
    };
    var uarr = Object.keys(goods);
    var j, len, gid_room_quota_map;
    for (i = 0, length = uarr.length; i < length; i += 1) {
        userid = uarr[i];
        g = goods[userid];
        len = Math.ceil(g.length / 30);
        for (j = 0; j < len; j += 1) {
            gid_room_quota_map = [];
            g.slice(j * 30, (j + 1) * 30).forEach(function(goods) {
                var roomQuota = [];
                var time = Date.now();
                var night, price, num;
                var k = 0;
                for (; k < 90; k += 1) {
                    night = dateformat(time, "yyyy-mm-dd");
                    time += 24 * 60 * 60 * 1000;

                    price = quotas[goods.roomtypeid];
                    if (price === undefined) {
                        goods.status = 2;
                        return null;
                    }

                    price = price[goods.ratetype];
                    if (price === undefined) {
                        goods.status = 2;
                        return null;
                    }

                    price = price[night];
                    if (price) {
                        num = price.num;
                        price = price.price;
                        if (goods.ptype == 1) price = Math.ceil(price * (goods.profit + 100) / 100) * 100;
                        else if (goods.ptype == 2) price = Math.ceil((price + goods.profit)) * 100;
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
                gid_room_quota_map.push({
                    gid: goods.gid,
                    roomQuota: roomQuota
                });
            });
            bagpipe.push(taobaorequest, {
                "access_token": users[userid],
                "method": "taobao.hotel.rooms.update",
                "gid_room_quota_map": JSON.stringify(gid_room_quota_map)
            }, callback);
            count += 1;
        }
    }
    quotas = null;
})["catch"](function(e) {
    console.log(e);
    process.exit(0);
});

function jielvrequest(data, callback) {
    data["Usercd"] = conf.jielv["Usercd"];
    data["Authno"] = conf.jielv["Authno"];
    data = new Buffer(JSON.stringify(data), "utf8");
    jielvOptions.headers["Content-Length"] = data.length;

    var result = new Buffer('');
    var request = http.request(jielvOptions, function(response) {
        response.on('data', function(chunk) {result = Buffer.concat([result, chunk]);});
        response.on('end', function() {
            try {
                result = '(' + result + ')';
                result = eval(result);

                var time = dateformat(new Date(), "[yyyy-mm-dd HH:MM:ss]");
                if (result && result.success == 8)
                    console.log(time, "jielv.ERROR", JSON.stringify(result.msg));

                callback(result);
            } catch(e) {
                callback(null);
            }
        });
    });

    request.setTimeout(1000 * 60);
    request.on('error', function(e) {callback(null);});
    request.write(data, 'utf8');
    request.end();
}
function taobaorequest(params) {
    params["v"] = "2.0";
    params["format"] = "json";

    var body = new Buffer("");
    var boundary = "----webkitformboundary";
    boundary += (+(new Date())).toString(16);

    (Object.keys(params)).forEach(function(p) {
        var field = util.format('\r\n--%s\r\n', boundary);
        field += util.format('Content-Disposition: form-data; name="%s"\r\n\r\n', p);
        field += params[p];
        field = new Buffer(field);
        body = Buffer.concat([body, field]);
    });
    body = Buffer.concat([body, new Buffer(util.format('\r\n--%s--', boundary))]);

    taobaoOptions.headers['Content-Length'] = body.length;
    taobaoOptions.headers['Content-Type'] = 'multipart/form-data; boundary=' + boundary;

    var result = new Buffer('');
    var request = https.request(taobaoOptions, function(response) {
        response.on('data', function(chunk) {result = Buffer.concat([result, chunk]);});
        response.on('end', function() {
            try {
                result = JSON.parse(result);
                var time = dateformat(new Date(), "[yyyy-mm-dd HH:MM:ss]");
                var message = "";
                var user = token.slice(47);
                if (result && result["error_response"]) {
                    message = result["error_response"]["sub_msg"];
                    message = message || result["error_response"]["msg"];
                    console.log(time, "taobao.ERROR", JSON.stringify(message), user, "(" + params["method"] + ")");
                }
                callback(result);
            } catch(e) {
                callback(null);
            }
        });
    });

    request.setTimeout(1000 * 60);
    request.on('error', function(e) {callback(null);});
    request.write(body, 'utf8');
    request.end();
}
function showMem() {
    var mem = process.memoryUsage();
    var format = function(bytes) {
        return (bytes / 1024 / 1024).toFixed(2) + "MB";
    };
    console.log("Process: heapTotal", format(mem.heapTotal), "heapUsed", format(mem.heapUsed), "rss", format(mem.rss));
}
});
