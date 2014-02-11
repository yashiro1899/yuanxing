var cookie = require("cookie");
var querystring = require('querystring');
var https = require('https');

var defaultOAuth2Conf = {
    appKey: '',
    appSecret: '',
    authorizationEndpoint: 'https://oauth.taobao.com/authorize',
    tokenEndpoint: 'https://oauth.taobao.com/token',
    redirectUri: ''
};

function OAuth2(conf) {
    this.conf = {};

    var k;
    for (k in defaultOAuth2Conf) {
        this.conf[k] = defaultOAuth2Conf[k];
    }

    if (!conf) conf = require('./taobao.conf');
    for (k in conf) {
        this.conf[k] = conf[k];
    }
}

OAuth2.prototype.getUserInfo = function(req, res) {
    var info = this._getAccessToken(req);

    if (Object.keys(info).length > 0) return getPromise(info);

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
        params['client_id'] = "21695917";
        params['client_secret'] = "f74cb82dafd6ee17b54bf0be707a5116";

        that._request(this.conf["tokenEndpoint"], params, null, function(error, data) {
            try {
                var result = JSON.parse(data);
                that._storeAccessToken(req, res, result);
                deferred.resolve(true);
            } catch(e) {
                deferred.resolve(false);
            }
        });
    }
    return deferred.promise;
};

OAuth2.prototype.accessProtectedResource = function(req, res, params) {
    var token = this._getAccessToken(req);
    var deferred = getDefer();

    token = token["access_token"];
    this._request("https://eco.taobao.com/router/rest", params, token, function(error, data) {
        try {
            var result = JSON.parse(data);
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

    if (access_token) params["access_token"] = access_token;
    var str = querystring.stringify(params);

    headers['Host'] = parsed.host;
    headers['Content-Length'] = params ? Buffer.byteLength(str) : 0;
    if (headers['Content-Length'] > 0) {
        headers['Content-Type'] = "application/x-www-form-urlencoded";
    }

    str = parsed.pathname + "?" + str;
    var options = {
        host: parsed.hostname,
        port: parsed.port,
        path: str,
        method: "POST",
        headers: headers
    };

    that._executeRequest(https, options, str, callback);
};

OAuth2.prototype._executeRequest = function(library, options, post_body, callback) {
    var that = this;
    var callbackCalled = false;
    var result = "";

    var request = library.request(options, function(response) {
        response.on("data", function(chunk) {
            result += chunk;
        });
        response.addListener("end", function() {
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
        callback(e, {});
    });

    request.write(post_body);
    request.end();
};

OAuth2.prototype._storeAccessToken = function(req, res, result) {
    var now = +(new Date());
    var data = {
        "taobao_user_id": result["taobao_user_id"],
        "taobao_user_nick": result["taobao_user_nick"],
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
