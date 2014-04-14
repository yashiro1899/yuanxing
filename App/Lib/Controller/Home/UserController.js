/**
 * controller
 * @return
 */
var cookie = require("cookie");
var dateformat = require("dateformat");
var mapping = require("../../../../define.conf");
var oauth = require("../../../../taobao-oauth");
var querystring = require('querystring');
module.exports = Controller("Home/BaseController", function() {
    return {
        navType: "user",
        title: "信息",
        indexAction: function() {
            var that = this;
            that.end("kk");
        }
    };
});
