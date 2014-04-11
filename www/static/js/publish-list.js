$(function() {
    var NOPRICE_ICON = "<i title=\"暂无价格\" class=\"icon-remove\"></i>";

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

    var elActionSelect = $("#result_list .action-select");
    var elActionToggle = $("#action-toggle");
    var elActionCounter = $(".actions .action-counter");
    var total = elActionSelect.length;

    elActionCounter.html(total + " of " + total + " selected");
    elActionSelect.change(function(e) {
        var selected = 0;
        elActionSelect.each(function(i, el) {
            if ($(el).prop("checked")) selected += 1;
        });
        elActionCounter.html(selected + " of " + total + " selected");
        elActionToggle.prop("checked", selected === total);
    });
    elActionToggle.change(function(e) {
        var checked = $(this).prop("checked");
        elActionSelect.prop('checked', checked);
        elActionCounter.html((checked ? total : 0) + " of " + total + " selected");
    });

    $("#action-go").click(function(e) {
        var selected = [];
        elActionSelect.each(function(i, el) {
            if ($(el).prop("checked")) selected.push(el);
        });
        if (selected.length === 0) return false;

        var action = $(".actions [name=action]").val();
        switch (action) {
            case "publish_selected":
                if (!window.confirm("确认发布所选 " + selected.length + " 项？")) return false;
                selected.reduce(function(sequence, el) {
                    return sequence.then(function(result) {
                        var td = $(el).parent().next();
                        td.html("询价中…");
                        $(window).scrollTop(td.position()["top"]);
                        return $.ajax("/publish/inquiry/", {
                            type: "post",
                            dataType: "json",
                            data: "roomtypeid=" + $(el).val()
                        }).then(function(result) {
                            if (result["success"] == 8) {
                                td.html("");
                                td.prev().html(NOPRICE_ICON);
                                return null;
                            }

                            var data = JSON.stringify(result);
                            td.html("发布中…");
                            return $.ajax("/publish/create/", {
                                type: "post",
                                dataType: "json",
                                data: "data=" + data
                            });
                        }).then(function(result) {
                            if (result && result["success"] == 1) {
                                td.html("发布成功");
                                td.prev().html("");
                            } else if (result) {
                                td.html("");
                                td.prev().html(NOPRICE_ICON);
                            }
                        });
                    });
                }, $().promise());
                break;
            default:
                break;
        }
    });
});
