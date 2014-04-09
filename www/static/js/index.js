$(function() {
    $("#result_list .precisely-connect").each(function(i, el) {
        el = $(el);
        var roomtypeid = el.data("roomtypeid");
        var td = el.parent();
        if ($.cookie("noprice." + roomtypeid)) td.html("暂无价格");
    });

    $("#result_list").on("click", ".precisely-connect", function(e) {
        var gid = $(this).data("gid");
        var roomtypeid = $(this).data("roomtypeid");
        var td = $(this).parent();

        td.html("询价中…");
        $.ajax("/publish/inquiry/", {
            type: "post",
            dataType: "json",
            data: "roomtypeid=" + roomtypeid
        }).done(function(response) {
            if (response["success"] == 8) {
                td.html("暂无价格");
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

    $("#result_list").on("click", ".connect-remove", function(e) {
        if (!window.confirm("确认删除？")) return false;

        var el = $(this);
        var gid = $(this).data("gid");
        $.ajax("/connect/delete/", {
            type: "post",
            dataType: "JSON",
            data: "gid=" + gid
        }).done(function(response) {
            if (response["success"] != 1) return false;
            el.parents("tr").remove();
        });
    });
});
