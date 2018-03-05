var Localize = require('localize');

var Translater = function () {
    this.translater = new Localize(APP_PATH + '/locale/');
};

/**
 * Get the translation.
 * @param {String} text The text to translate.
 * @param {String} locale The target locale, like 'en' or 'es'.
 * @param {Array} params Optional. An array of arguments.
 * @return {String}
 */
Translater.prototype.translate = function (text, locale, params) {
    locale = locale || 'en';
    this.translater.setLocale(locale);
    try {
        if (params && params.length == 1) {
            return this.translater.translate(text, params[0]);
        } else if (params && params.length == 2) {
            return this.translater.translate(text, params[0], params[1]);
        }
        return this.translater.translate(text);
    } catch (e) {
        return text;
    }
};

module.exports = new Translater();
