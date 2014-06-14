$(function() {
    $("#result_list").on("click", ".precisely-connect", function(e) {
        var gid = $(this).data("gid");
        var roomtypeid = $(this).data("roomtypeid");
        var td = $(this).parent();

        td.html("询价中…");
        $.ajax("/publish/quotas/", {
            type: "post",
            dataType: "json",
            data: {"roomtypeid": roomtypeid}
        }).done(function(response) {
            if (response["success"] == 8) {
                td.html("暂无价格");
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

    elActionCounter.html("0 of " + total + " selected");
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
            case "delete_selected":
                if (!window.confirm("确认删除所选 " + selected.length + " 项？")) return false;
                selected.reduce(function(sequence, el) {
                    $(window).scrollTop($(el).position()["top"]);
                    return sequence.then(function(result) {
                        return $.ajax("/connect/delete/", {
                            type: "post",
                            dataType: "JSON",
                            data: "gid=" + $(el).val()
                        }).then(function(result) {
                            if (result["success"] == 1) {
                                $(el).parents("tr").remove();
                                counter();
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
