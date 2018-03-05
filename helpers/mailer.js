var mandrill = require('mandrill-api/mandrill');
var jade = require('jade');
var fs = require('fs');
//var Iconv  = require('iconv').Iconv;
var translater = require('./translater');

Mandrill = function() {
  this.config = config.get('mail');
};

Mandrill.prototype.getClient = function () {
  return new mandrill.Mandrill(this.config.auth.apikey);
};

Mandrill.prototype.renderTemplate = function (name, params, language) {
  var path = APP_PATH + 'views/mail/'+ name +'.jade';
  // Load localized emails.
  if (language != 'en') {
    path = APP_PATH + 'views/mail/' + name + '-' + language + '.jade';
  }

  //var iconv = new Iconv('ISO-8859-1', 'UTF-8');
  //var contents = iconv.convert(fs.readFileSync(path)).toString();
  var contents = fs.readFileSync(path);

  var fn = jade.compile(contents, {
    filename: path, pretty: true
  });

  return fn(params);
};

Mandrill.prototype.send = function(options, templateOptions, done) {
  var client = this.getClient();
  var config = this.config;
  var send_options = { "message": options, "async": false };

  done = done || function () {};

  if (options.from) {
    options.from_email = options.from.email;
    options.from_name = options.from.name;
    delete options[from];
  } else {
    options.from_email = config.from.email;
    options.from_name = config.from.name;
  }

  if (templateOptions.text) {
    options.text = templateOptions.text;
  }

  // Get localized subject.
  options.subject = translater.translate(options.subject, templateOptions.language || 'en');

  options.html = this.renderTemplate(templateOptions.name, templateOptions.params, templateOptions.language || 'en');

  // additional options
  options.important = options.important || false;

  client.messages.send(send_options, function(result) {
    done(false, result);
  }, function(error) {
    done(error, false);
  });
};

module.exports = function () {
  return new Mandrill();
};
