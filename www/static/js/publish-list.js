$(function() {
    var NOPRICE_ICON = "<i title=\"暂无价格\" class=\"icon-remove\"></i>";

    $("#result_list .precisely-publish").each(function(i, el) {
        var roomtypeid = $(this).data("roomtypeid");
        var td = $(this).parent();
        if ($.cookie("noprice." + roomtypeid)) {
            td.html("");
            td.prev().html(NOPRICE_ICON);
        }
    });

    $("#result_list").on("click", ".precisely-publish", function(e) {
        var roomtypeid = $(this).data("roomtypeid");
        var td = $(this).parent();

        td.append("<span>询价中…</span>");
        $(this).hide();
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

            if (!window.confirm("确认发布？")) {
                $("span", td).remove();
                $("a", td).show();
                return false;
            }
            td.html("发布中…");
            $.ajax("/publish/create/", {
                type: "post",
                dataType: "json",
                data: "data=" + JSON.stringify(response)
            }).done(function(response) {
                td.html("");
                if (response["success"] == 1) {
                    location.href = "/connect/";
                    return null;
                }
                td.prev().html(NOPRICE_ICON);
                alert(response["message"]);
            });
        });
    });
});
