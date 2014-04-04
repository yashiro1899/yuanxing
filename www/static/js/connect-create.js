$(function() {
    var form = $("#connect-form");
    $("[name=ptype]", form).change(function(e) {
        if (this.value == 1) $(".add-on", form).text("%");
        else if (this.value == 2) $(".add-on", form).text("元");
    });
});
