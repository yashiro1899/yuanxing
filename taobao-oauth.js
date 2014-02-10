var cookie = require("cookie");
var querystring = require('querystring');

var defaultOAuth2Conf = {
    appKey: '',
    appSecret: '',
    authorizationEndpoint: 'https://oauth.taobao.com/authorize',
    tokenEndpoint: 'https://oauth.taobao.com/token',
    redirectUri: '',
    authorizationCallback: function(req, res, error, result) {
        res.json({
            error: error,
            result: result
        });
    }
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

OAuth2.getUserInfo = function(req, res) {
    return (new OAuth2()).getUserInfo(req, res);
};

OAuth2.prototype.getUserInfo = function(req, res) {
    var info = cookie.parse(req.headers.cookie || "");

    if (Object.keys(info).length > 0) return getPromise(info);

    this.obtainingAuthorization(req, res);
    return getDefer().promise;
};

OAuth2.prototype.obtainingAuthorization = function(req, res, params) {
    var url = this.conf["authorizationEndpoint"];
    var params = params || {
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

module.exports = OAuth2;
