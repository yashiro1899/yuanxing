/**
 * controller
 * @return
 */
var oauth = require("../../../../taobao-oauth");
module.exports = Controller("Home/BaseController", function() {
    return {
        indexAction: function() {
            var that = this;
            var promise = oauth.accessProtectedResource(this.http.req, this.http.res, {
                fields: "approve_status,num_iid,title,nick,type,cid,pic_url,num,props,valid_thru,list_time,price,has_discount,has_invoice,has_warranty,has_showcase,modified,delist_time,postage_id,seller_cids,outer_id",
                format: "json",
                method: "taobao.items.onsale.get"
            }).then(function(result) {
                if (result && result["items_onsale_get_response"] && result["items_onsale_get_response"]["total_results"] !== 0)
                    result = result["items_onsale_get_response"]["items"]["item"];
                else
                    result = [];
                that.assign("list", result);
                that.display();
            });

            return promise;
        },
        testAction: function() {
            var that = this;
            var promise = oauth.accessProtectedResource(this.http.req, this.http.res, {
                "address": "address",
                "city": 110100,
                "country": "China",
                "desc": "jjj",
                "domestic": true,
                "format": "json",
                "level": "A",
                "method": "taobao.hotel.add",
                "name": "北京饭店",
                "orientation": "T",
                "pic": '/Users/mac/Pictures/russell.jpg',
                "province": 110000
            });

            return promise.then(function(result) {
                that.end(result);
            });
        }
    };
});
