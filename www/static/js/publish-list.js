$(function() {
    var NOPRICE_ICON = "<i title=\"暂无价格\" class=\"icon-remove\"></i>";

    $("#result_list .precisely-publish").each(function(i, el) {
        el = $(el);
        var roomtypeid = el.data("roomtypeid");
        var td = el.parent();
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

            var data = JSON.stringify(response);
            td.html("发布中…");
            $.ajax("/publish/create/", {
                type: "post",
                dataType: "json",
                data: "data=" + data
            }).done(function(response) {
                td.html("");
                if (response["success"] == 1) {
                    $('<form action="/connect/create/" method="post">\
                      <textarea name="data">' + data + '</textarea>\
                      <input type="hidden" name="gid" value="' + response.gid + '" />\
                      <input type="hidden" name="roomtypeid" value="' + roomtypeid + '" />\
                      </form>').submit();
                    return null;
                }
                td.prev().html(NOPRICE_ICON);
                alert(response["message"]);
            });
        });
    });

    var actiontotal = $("#result_list .action-select").length;
    $(".actions .action-counter").html(actiontotal + " of " + actiontotal + " selected");
});
