'use strict';

/* Filters */

angular.module('App.filters', [])
.filter('interpolate', function (version) {
  return function (text) {
    return String(text).replace(/\%VERSION\%/mg, version);
  }
})
.filter('default', function() {
  return function(input, value) {
    return out =
      input != null && input != undefined && (input != "" || angular.isNumber(input)) ?
        input : value || '';
  }
})
.filter('cut', function () {
    return function (value, wordwise, max, tail) {
        if (!value) return '';

        max = parseInt(max, 10);
        if (!max) return value;
        if (value.length <= max) return value;

        value = value.substr(0, max);
        if (wordwise) {
            var lastspace = value.lastIndexOf(' ');
            if (lastspace != -1) {
                value = value.substr(0, lastspace);
            }
        }
        return value + (tail || ' …');
    };
})
.filter('orderByVotes', function() {
  return function(items) {
    items.sort(function (a, b) {
      return b.upvotes_count - a.upvotes_count;
    });
    return items;
  };
})
.filter('notAssigned', function($filter){
    return function(list, arrayFilter, element){
        if(arrayFilter){
            return $filter("filter")(list, function(listItem){
                return arrayFilter.indexOf(listItem[element]) == -1;
            });
        }
    };
})
.filter('unassigned', function() {
  return function(items, currentUsersArray){

    var filtered = [];
    angular.forEach(items, function(item) {
	  var filterFlag = false;

	  angular.forEach(currentUsersArray, function(elem){
		if (item.user) {
		  if (item.user && item.user._id == elem.user) {
		    filterFlag = true;
		  }
		} else {
		  if (item.invite_email == elem.invite_email) {
		    filterFlag = true;
		  }
		}
	  });

      if(filterFlag == false) {
        filtered.push(item);
      }

    });

    return filtered;
  };
});
