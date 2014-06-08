process.on('message', function(roomtypeids) {
var Agent = require("agentkeepalive");
var Bagpipe = require('bagpipe');
var conf = require('../auth.conf');
var dateformat = require("dateformat");
var http = require('http');
var Promise = require('es6-promise').Promise;

var getDefer = function() {
    var deferred = {};
    deferred.promise = new Promise(function(resolve, reject) {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });
    return deferred;
};

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
        deferred.resolve(quotas);
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
function showMem() {
    var mem = process.memoryUsage();
    var format = function(bytes) {
        return (bytes / 1024 / 1024).toFixed(2) + "MB";
    };
    console.log("Process: heapTotal", format(mem.heapTotal), "heapUsed", format(mem.heapUsed), "rss", format(mem.rss));
}
});
