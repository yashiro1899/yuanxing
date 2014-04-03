$(function() {
    var NOPRICE_ICON = "<i title=\"暂无价格\" class=\"icon-remove\"></i>";

    $("#result_list .precisely-connect").each(function(i, el) {
        el = $(el);
        var roomtypeid = el.data("roomtypeid");
        var td = el.parent();
        if ($.cookie("noprice." + roomtypeid)) {
            td.html("");
            td.prev().html(NOPRICE_ICON);
        }
    });

    $("#result_list").on("click", ".precisely-connect", function(e) {
        var gid = $(this).data("gid");
        var roomtypeid = $(this).data("roomtypeid");
        var td = $(this).parent();

        $(this).html("询价中…");
        $.ajax("/publish/inquiry/", {
            type: "post",
            dataType: "json",
            data: "roomtypeid=" + roomtypeid
        }).done(function(response) {
            if (response["success"] == 8) {
                td.html("");
                td.prev().html(NOPRICE_ICON);
                alert(response["message"]);
                return null;
            }

            $('<form action="/connect/create/" method="post">\
              <textarea name="data">' + JSON.stringify(response) + '</textarea>\
              <input type="hidden" name="gid" value="' + gid + '" />\
              <input type="hidden" name="roomtypeid" value="' + roomtypeid + '" />\
              </form>').submit();
        });
    });
});
