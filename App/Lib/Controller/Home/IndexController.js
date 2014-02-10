/**
 * controller
 * @return
 */
module.exports = Controller("Home/BaseController", function() {
    return {
        indexAction: function() {
            this.display();
        }
    }
});
