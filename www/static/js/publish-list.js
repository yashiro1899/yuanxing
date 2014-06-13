$(function() {
    var NOPRICE_ICON = "<i title=\"暂无价格\" class=\"icon-remove\"></i>";

    $("#result_list").on("click", ".precisely-publish", function(e) {
        var roomtypeid = $(this).data("roomtypeid");
        var td = $(this).parent();
        var quotas;

        td.append("<span>询价中…</span>");
        $(this).hide();
        $.ajax("/publish/quotas/", {
            type: "post",
            dataType: "json",
            data: {roomtypeid: roomtypeid}
        }).then(function(response) {
            if (response["success"] == 1) {
                if (!window.confirm("确认发布？")) {
                    $("span", td).remove();
                    $("a", td).show();
                    return $.Deferred().promise();
                }

                quotas = response["data"];
                td.html("发布中…");
                return $.ajax("/publish/create/", {
                    type: "post",
                    dataType: "json",
                    data: {roomtypeid: roomtypeid}
                });
            } else if (response["success"] == 8) {
                td.html("");
                td.prev().html(NOPRICE_ICON);
                alert(response["message"]);
                return $.Deferred().promise();
            }
        }).then(function(response) {
            td.html("");
            console.log(response);
            //     if (response["success"] == 1) {
            //         $('<form action="/connect/create/" method="post">\
            //           <textarea name="data">' + data + '</textarea>\
            //           <input type="hidden" name="gid" value="' + response.gid + '" />\
            //           <input type="hidden" name="roomtypeid" value="' + roomtypeid + '" />\
            //           </form>').submit();
            //         return null;
            //     }
            //     td.prev().html(NOPRICE_ICON);
            //     alert(response["message"]);
            // });
        });
    });

    var elActionSelect = $("#result_list .action-select");
    var elActionToggle = $("#action-toggle");
    var elActionCounter = $(".actions .action-counter");
    var total = elActionSelect.length;
    var counter = function() {
        var selected = 0;
        elActionSelect = $("#result_list .action-select");
        total = elActionSelect.length;
        elActionSelect.each(function(i, el) {
            if ($(el).prop("checked")) selected += 1;
        });
        elActionCounter.html(selected + " of " + total + " selected");
        return selected;
    };

    elActionCounter.html(total + " of " + total + " selected");
    elActionSelect.change(function(e) {
        var selected = counter();
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
                        return $.ajax("/publish/quotas/", {
                            type: "post",
                            dataType: "json",
                            data: {roomtypeid: $(el).val()}
                        }).then(function(result) {
                            if (result["success"] == 8) {
                                td.html("");
                                td.prev().html(NOPRICE_ICON);
                                counter();
                                return $.Deferred().promise();
                            }

                            td.html("发布中…");
                            return $.ajax("/publish/create/", {
                                type: "post",
                                dataType: "json",
                                data: {roomtypeid: $(el).val()}
                            });
                        }).then(function(result) {
                            if (result["success"] == 1) {
                                td.html("发布成功");
                                td.prev().html("<i title=\"已发布\" class=\"icon-upload\"></i>");
                            } else if (result) {
                                td.html("");
                                td.prev().html(NOPRICE_ICON);
                            }
                            counter();
                        });
                    });
                }, $().promise());
                break;
            default:
                break;
        }
    });
});
