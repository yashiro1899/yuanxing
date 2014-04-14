$(function() {
    var form = $("#user-form").submit(function(e) {
        var elGuide = $(form[0].guide);
        var elPicPath = $(form[0].pic_path);

        if (!elGuide.val()) {
            elGuide.parent().addClass("error");
            elGuide.next().show();
            elGuide.focus();
            return false;
        } else {
            elGuide.parent().removeClass("error");
            elGuide.next().hide();
        }

        if (!(/^http:\/\/img\d{2}\.taobaocdn\.com/.test(elPicPath.val()))) {
            elPicPath.parent().addClass("error");
            elPicPath.next().show();
            elPicPath.focus();
        } else {
            $("<img src=\"" + elPicPath.val() + "\" />").load(function(e) {
                elPicPath.parent().removeClass("error");
                elPicPath.next().hide();
                form.unbind("submit").submit();
            }).error(function(e) {
                elPicPath.parent().addClass("error");
                elPicPath.next().show();
                elPicPath.focus();
            });
        }

        return false;
    });
});
