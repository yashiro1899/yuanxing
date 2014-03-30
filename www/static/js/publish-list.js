$(function() {
    $("#result_list .precisely-publish").each(function(i, el) {
        var roomtypeid = $(this).data("roomtypeid");
        var td = $(this).parent();
    });

    $("#result_list").on("click", ".precisely-publish", function(e) {
        var roomtypeid = $(this).data("roomtypeid");
        var td = $(this).parent();

        td.html("发布中…");
        $.ajax("/publish/create/", {
            type: "post",
            dataType: "json",
            data: "roomtypeid=" + roomtypeid
        }).done(function(response) {
            if (response["success"] == 8) {
                td.html("");
                td.prev().html("<i title=\"暂无价格\" class=\"icon-remove\"></i>");
                alert(response["message"]);
                return null;
            }
            console.log(response);
        });
    });
});
