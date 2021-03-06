/**
 * controller
 * @return
 */
var cookie = require("cookie");
var dateformat = require("dateformat");
module.exports = Controller("Home/BaseController", function() {
    return {
        navType: "user",
        title: "信息",
        indexAction: function() {
            var that = this;
            var promise = D("User").where("id=" + this.userInfo["taobao_user_id"]).select();
            promise = promise.then(function(result) {
                result = result || [];
                result = result[0] || {};

                var expires = result["expires"];
                if (expires) result["expires"] = dateformat(expires, "yyyy-mm-dd HH:MM");
                that.assign("formdata", result);
                that.display();
            });
            return promise;
        },
        updateAction: function() {
            var that = this;
            var id = this.post("id");
            var pic_path = this.post("pic_path");
            var guide = this.post("guide");

            if (id && pic_path && guide) {
                return D("User").update({
                    id: id,
                    pic_path: pic_path,
                    guide: guide
                }).then(function(result) {
                    var content = "编辑成功！";
                    that.http.res.setHeader("Set-Cookie", cookie.serialize("success.message", content, {path: "/"}));
                    that.redirect("/connect/");
                });
            } else {
                this.redirect("/connect/");
            }
        }
    };
});
