var cookie = require("cookie");
var fs = require("fs");
var https = require('https');
var path = require('path');
var querystring = require('querystring');
var util = require("util");
var Promise = require('es6-promise').Promise;

var getDefer = function() {
    var deferred = {};
    deferred.promise = new Promise(function(resolve, reject) {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });
    return deferred;
};

var defaultOAuth2Conf = {
    appKey: '',
    appSecret: '',
    authorizationEndpoint: 'https://oauth.taobao.com/authorize',
    tokenEndpoint: 'https://oauth.taobao.com/token',
    apiEndpoint: "https://eco.taobao.com/router/rest",
    redirectUri: ''
};

function OAuth2(conf) {
    this.conf = {};

    var k;
    for (k in defaultOAuth2Conf) {
        this.conf[k] = defaultOAuth2Conf[k];
    }

    if (!conf) conf = require('./auth.conf').taobao;
    for (k in conf) {
        this.conf[k] = conf[k];
    }
}

OAuth2.prototype.getUserInfo = function(req, res) {
    var info = this._getAccessToken(req);

    if (Object.keys(info).length > 0) return Promise.resolve(info);

    this.obtainingAuthorization(req, res);
    return getDefer().promise;
};

OAuth2.prototype.obtainingAuthorization = function(req, res, params) {
    var url = this.conf["authorizationEndpoint"];
    params = params || {
        'client_id': this.conf.appKey,
        'redirect_uri': this.conf.redirectUri
    };

    params['response_type'] = 'code';
    url += "?";
    url += querystring.stringify(params);

    res.statusCode = 302;
    res.setHeader("Location", url);
    res.end();
};

OAuth2.prototype.redirectCallback = function(req, res, code) {
    var that = this;
    var deferred = getDefer();
    var params = {};
    var post_data;

    if (!code) {
        deferred.resolve(false);
        return deferred.promise;
    } else {
        params['grant_type'] = 'authorization_code';
        params['code'] = code;
        params['redirect_uri'] = this.conf["redirectUri"];
        params['client_id'] = this.conf["appKey"];
        params['client_secret'] = this.conf["appSecret"];

        that._request(this.conf["tokenEndpoint"], params, null, function(error, data) {
            if (error) {
                deferred.resolve(null);
                return false;
            }

            try {
                var result = JSON.parse(data);
                that._storeAccessToken(req, res, result);
                deferred.resolve(result);
            } catch(e) {
                deferred.resolve(null);
            }
        });
    }
    return deferred.promise;
};

OAuth2.prototype.accessProtectedResource = function(req, res, params, token) {
    token = token || this._getAccessToken(req)["access_token"];

    var deferred = getDefer();
    params["v"] = "2.0";
    params["format"] = "json";
    this._request(this.conf["apiEndpoint"], params, token, function(error, data) {
        if (error) {
            deferred.resolve(null);
            return false;
        }

        try {
            var result = JSON.parse(data);
            if (result && result["error_response"]) console.log("ERROR taobao", result["error_response"]["sub_msg"]);

            deferred.resolve(result);
        } catch(e) {
            deferred.resolve(null);
        }
    });
    return deferred.promise;
};

OAuth2.prototype._request = function(url, params, access_token, callback) {
    var that = this;
    var parsed = require('url').parse(url, true);
    var headers = {};
    var getMimeType = require('simple-mime')('application/octect-stream');
    var boundary = "----webkitformboundary";
    var body = "";
    boundary += (+(new Date())).toString(16);

    if (params.pic) {
        body += util.format('\r\n--%s\r\n', boundary);
        body += util.format('Content-Disposition: form-data; name="pic"; filename="%s"\r\n', params.pic);
        body += util.format('Content-Type: %s\r\n\r\n', getMimeType(params.pic));
        body = new Buffer(body);
        body = Buffer.concat([body, fs.readFileSync(params.pic), new Buffer(util.format('\r\n--%s--', boundary))]);
        delete params.pic;
    }
    if (params.room_quotas) {
        body += util.format('\r\n--%s\r\n', boundary);
        body += 'Content-Disposition: form-data; name="room_quotas"\r\n\r\n';
        body = new Buffer(body);
        body = Buffer.concat([body, new Buffer(params.room_quotas), new Buffer(util.format('\r\n--%s--', boundary))]);
        delete params.room_quotas;
    }
    if (params.gid_room_quota_map) {
        body += util.format('\r\n--%s\r\n', boundary);
        body += 'Content-Disposition: form-data; name="gid_room_quota_map"\r\n\r\n';
        body = new Buffer(body);
        body = Buffer.concat([body, new Buffer(params.gid_room_quota_map), new Buffer(util.format('\r\n--%s--', boundary))]);
        delete params.gid_room_quota_map;
    }
    if (access_token) params["access_token"] = access_token;

    headers['Host'] = parsed.host;
    headers['Content-Length'] = body ? body.length : 0;
    if (headers['Content-Length'] > 0) {
        headers['Content-Type'] = 'multipart/form-data; boundary=' + boundary + '';
    }

    var options = {
        host: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + "?" + querystring.stringify(params),
        method: "POST",
        headers: headers
    };

    that._executeRequest(https, options, body, callback);
};

OAuth2.prototype._executeRequest = function(library, options, post_body, callback) {
    var that = this;
    var callbackCalled = false;
    var result = new Buffer('');

    var request = library.request(options, function(response) {
        response.on("data", function(chunk) {
            result = Buffer.concat([result, chunk]);
        });
        response.on("end", function() {
            if (!callbackCalled) {
                callbackCalled = true;
                if (response.statusCode != 200 && (response.statusCode != 301) && (response.statusCode != 302)) {
                    callback({
                        statusCode: response.statusCode,
                        data: result
                    });
                } else {
                    callback(null, result, response);
                }
            }
        });
    });
    request.on('error', function(e) {
        callbackCalled = true;
        callback(e, null);
    });

    request.write(post_body);
    request.end();
};

OAuth2.prototype._storeAccessToken = function(req, res, result) {
    var now = +(new Date());
    var data = {
        "taobao_user_id": result["taobao_user_id"],
        "taobao_user_nick": decodeURIComponent(result["taobao_user_nick"]),
        "access_token": result["access_token"]
    };
    data = querystring.stringify(data);
    data = rot13(data);
    data = cookie.serialize("access_token.taobao", data, {
        path: "/",
        expires: (new Date(result["expires_in"] * 1000 + now))
    });

    res.setHeader("Set-Cookie", data);
};

OAuth2.prototype._getAccessToken = function(req) {
    var info = cookie.parse(req.headers.cookie || "");

    info = info["access_token.taobao"];
    info = rot13(info);
    info = querystring.parse(info);
    return info;
};

function rot13(s) {
    var i;
    var rotated = '';
    s = s || "";
    for (i = 0; i < s.length; i++) {
        var ch = s.charCodeAt(i);
        // a-z -> n-m
        if (97 <= ch && ch <= 122) {
            rotated += String.fromCharCode((ch - 97 + 13) % 26 + 97);
            // A-Z -> N-M
        } else if (65 <= ch && ch <= 90) {
            rotated += String.fromCharCode((ch - 65 + 13) % 26 + 65);
        } else {
            rotated += s[i];
        }
    }
    return rotated;
}

module.exports = new OAuth2();
