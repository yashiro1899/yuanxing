var conf = require('./auth.conf').jielv;
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

var host = conf["host"] || "chstravel.com";
var port = conf["port"] || "30000";
var options = {
    host: host,
    port: port,
    path: "/commonQueryServlet",
    method: "POST",
    headers: {
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Host": host + ":" + port,
        "Content-Length": 0
    }
};

module.exports = function(data) {
    data["Usercd"] = conf["Usercd"];
    data["Authno"] = conf["Authno"];
    data = new Buffer(JSON.stringify(data), "utf8");
    options.headers["Content-Length"] = data.length;

    var deferred = getDefer();
    var result = new Buffer('');
    var request = http.request(options, function(response) {
        response.on('data', function(chunk) {result = Buffer.concat([result, chunk]);});
        response.on('end', function() {
            try {
                result = '(' + result + ')';
                result = eval(result);
                var time = dateformat(new Date(), "[yyyy-mm-dd HH:MM:ss]");
                if (result && result.success == 8) console.log(time, "jielv.ERROR", JSON.stringify(result.msg));

                deferred.resolve(result);
            } catch(e) {
                deferred.resolve(null);
            }
        });
    });

    request.setTimeout(1000 * 60);
    request.on('error', function(e) {deferred.resolve(null);});
    request.write(data, 'utf8');
    request.end();
    return deferred.promise;
};
