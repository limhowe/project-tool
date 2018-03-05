var AWS_S3_URL = 'https://s3.amazonaws.com/';

exports.upload = function (object, type, name, file) {
  var s3 = new AWS.S3();
  var deffered = Q.defer();

  var bucket = new AWS.S3({
    params: { Bucket: 'taskhammer-' + object }
  });

  var data = {
    Key: type + '-' + name,
    Body: file,
    ACL: 'public-read'
  };

  bucket.putObject(data, function(error, data){
    if (error)
      deffered.reject(error);
    else
      deffered.resolve(exports.generate_url(object, type, name));
  });

  return deffered.promise;
};

exports.generate_url = function (object, type, name) {
  return AWS_S3_URL + 'taskhammer-' + object + '/' + type + '-' + name
}

exports.get_url = function (object, type, name) {
  var s3 = new AWS.S3();
  var deffered = Q.defer();

  var bucket = new AWS.S3({
    params: { Bucket: 'taskhammer-' + object }
  });

  var options = {
    Bucket: 'taskhammer-' + object,
    Key: type + '-' + name
  };

  bucket.getSignedUrl('getObject', options, function(error, url){
    error ? deffered.reject(error) : deffered.resolve(url);
  });

  return deffered.promise;
};

exports.get_file = function (object, type, name, done) {
  var s3 = new AWS.S3();

  var bucket = new AWS.S3({
    params: { Bucket: 'taskhammer-' + object }
  });

  var options = {
    Bucket: 'taskhammer-' + object,
    Key: type + '-' + name
  };

  bucket.getObject(options, function(error, data){
    done(error, data && data.Body);
  });

};
