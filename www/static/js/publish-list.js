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
        if (!window.confirm("确认发布？")) return false;

        td.html("询价中…");
        $.ajax("/publish/inquiry/", {
            type: "post",
            dataType: "json",
            data: "roomtypeid=" + roomtypeid
        }).done(function(response) {
            td.html("");
            if (response["success"] == 8) {
                td.prev().html(NOPRICE_ICON);
                alert(response["message"]);
                return null;
            }
            $.ajax("/publish/create/", {
                type: "post",
                dataType: "json",
                data: "data=" + JSON.stringify(response)
            }).done(function(response) {
                if (response["success"] == 1) {
                    alert(response["message"]);
                    location.href = "/connect/";
                    return null;
                }
                td.prev().html(NOPRICE_ICON);
                alert(response["message"]);
            });
        });
    });
});
