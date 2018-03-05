'use strict';

angular.module('App.services')
.service('Testimonial', function () {
  var self = this;

  self.all = function () {
    var testimonials = [
      { desc: '"Gives you access to robust tools while keeping the application and use of the tools simple. Amazing."', author: '~ What our customers are saying.' },
      { desc: '"Very impressed with your product. Nice work!"', author: '~ What our customers are saying.' },
      { desc: '"This is exactly the combination of classical and agile tools I was looking for."', author: '~ What our customers are saying.' }
    ];

    return testimonials;
  };

  self.random = function (value) {
    var testimonials = self.all();
    testimonials.sort(function() { return 0.5 - Math.random() });
    return testimonials.shift();
  };
});
