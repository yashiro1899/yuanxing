$(function() {
    $("#result_list").on("click", ".precisely-connect", function(e) {
        var gid = $(this).data("gid");
        var roomtypeid = $(this).data("roomtypeid");
        var td = $(this).parent();

        td.html("询价中…");
        $.ajax("/publish/quotas/", {
            type: "post",
            dataType: "json",
            data: {roomtypeid: roomtypeid}
        }).done(function(response) {
            if (response["success"] == 8) {
                td.html("");
                td.prev().html("<i title=\"暂无价格\" class=\"icon-remove\"></i>");
                alert(response["message"]);
                return null;
            } else if (response["success"] == 1) {
                $('<form action="/connect/edit/" method="post">\
                  <textarea name="data">' + JSON.stringify(response.data) + '</textarea>\
                  <input type="hidden" name="gid" value="' + gid + '" />\
                  </form>').submit();
            }
        });
    });
});
