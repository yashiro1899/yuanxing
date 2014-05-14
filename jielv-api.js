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
var conf = require('./auth.conf').jielv;

module.exports = function(data) {
    if (!data) return getDefer().promise;

    data["Usercd"] = conf["Usercd"];
    data["Authno"] = conf["Authno"];

    var host = conf["host"] || "chstravel.com";
    var port = conf["port"] || "30000";
    var headers = {};
    var options = {
        host: host,
        port: port,
        path: "/commonQueryServlet",
        method: "POST",
    };

    data = JSON.stringify(data);
    data = new Buffer(data, 'utf8');
    headers["Cache-Control"] = "no-cache";
    headers["Pragma"] = "no-cache";
    headers['Host'] = host + ":" + port;
    headers["Content-Length"] = data.length;
    options["headers"] = headers;

    var deferred = getDefer();
    var result = new Buffer('');
    var request = http.request(options, function(response) {
        response.on('data', function(chunk) {
            result = Buffer.concat([result, chunk]);
        });
        response.on('end', function() {
            try {
                result = '(' + result + ')';
                result = eval(result);
                if (result && result.success == 8) console.log("ERROR", result.msg);

                deferred.resolve(result);
            } catch(e) {
                deferred.resolve(null);
            }
        });
    });

    request.on('error', function(e) {
        deferred.resolve(null);
    });

    request.write(data, 'utf8');
    request.end();
    return deferred.promise;
};
