var cookie = require("cookie");

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
    for (k in conf) {
        this.conf[k] = conf[k];
    }
}

OAuth2.prototype.getUserInfo = function(req, res) {
    var _cookie = cookie.parse(req.headers.cookie || "");
    console.log(_cookie);
    return getPromise({});
};

module.exports = OAuth2;
