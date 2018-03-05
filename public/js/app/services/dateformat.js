'use strict';

angular.module('App.services')
.service('DateFormat', function () {
  var self = this;

  self.formats = function () {
    var formats = [
      { value: 'en-US', str: 'MM-dd-yyyy' },
      { value: 'en-GB', str: 'dd-MM-yyyy' },
    ];

    return formats;
  };

  self.getFormat = function(value) {
    var dateformats = self.formats();

    for(var i=0; i<dateformats.length; i++) {
      if (dateformats[i].value === value) return dateformats[i];
    }

    return dateformats[0];
  }
});
