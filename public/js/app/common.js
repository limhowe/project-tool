$(document).ready(function () {
    $(document).click(function (evt) {
        if ($('.navbar-collapse').hasClass('navbar-collapse in') === true && !$(evt.target).hasClass('navbar-toggle')) {
            $('button.navbar-toggle').click();
        }
    });

    $('*[contenteditable]').on('paste', function (evt) {
        evt.preventDefault();
        document.execCommand('insertHTML', false, evt.clipboardData.getData('text/plain'));
    });
});
