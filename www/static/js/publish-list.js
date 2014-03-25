$(function() {
    $("#result_list").on("click", ".precisely-publish", function(e) {
        var roomtypeid = $(this).data("roomtypeid");
        var form = $("#precisely-publish");
        $("[name=roomtypeid]", form).val(roomtypeid);
        form.submit();
    });
});
