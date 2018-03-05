'use strict';

angular.module('App').directive('editable', function($rootScope, $timeout, $filter, linkyFilter) {
return {
  restrict: 'A', // only activate on element attribute
  require: '?ngModel',
  link: function( scope, elem, attrs, $ngModel ) {

    var text;
    var $editable = angular.element(elem);
    var $parent = $editable.parent();
    var cache = $editable.html();
    var editing;
    var enterPressed;
    var escaped;
    attrs.linkify = true;


    //for HTML linkify
    function Nestedlinkify(input) {
      var ELEMENT_NODE = 1;
      var TEXT_NODE = 3;
      var linkifiedDOM = document.createElement('div');
      var inputDOM = document.createElement('div');

      function htmlLinkify(startNode) {
        var i, ii, currentNode;

        if (startNode && startNode.childNodes) {
          for (i = 0, ii = startNode.childNodes.length; i < ii; i++) {
            currentNode = startNode.childNodes[i];

            switch (currentNode.nodeType) {
              case ELEMENT_NODE:
                htmlLinkify(currentNode);
                break;
              case TEXT_NODE:
                linkifiedDOM.innerHTML = linkyFilter(currentNode.textContent);
                i += linkifiedDOM.childNodes.length - 1
                while(linkifiedDOM.childNodes.length) {
                  startNode.insertBefore(linkifiedDOM.childNodes[0], currentNode);
                }
                startNode.removeChild(currentNode);
            }
          }
        }

        return startNode;
      }

      inputDOM.innerHTML = input;
      return htmlLinkify(inputDOM).innerHTML;
    }

    // Specify how UI should be updated
    // add html validation here
    $ngModel.$render = function() {
      if (!attrs.linkify) {
        $editable.html( $ngModel.$viewValue );
      }else{
        $editable.html(Nestedlinkify($ngModel.$viewValue));
      }

    };

    scope.$watch('$ngModel', function(value) {
      $ngModel.$render()
    });


    function saveChanges(){

      text = $editable.html();
      // api call
      if (text.length > 0 && attrs.editEnter && text != cache) {
        if (attrs.editConfirm) {
          scope.$apply(attrs.editConfirm);
        }else{
          var _editData = {
                      text: text,
                      _id: JSON.parse(attrs.editData)._id,
                      data: JSON.parse(attrs.editData),
                      scope: angular.element($editable).scope()
                    }
          $rootScope[attrs.editEnter](_editData)
        }
      }else{
        if (attrs.alt) {
          $editable.html(attrs.alt);
        }else{
          $editable.html(cache);
        }
      }

      $ngModel.$setViewValue( $editable.html() );
      $ngModel.$render()

    }

  //-===================================================================================
  //- parse text
  //-===================================================================================
    $editable.on("paste", function(e) {
      e.preventDefault();
      var text = e.originalEvent.clipboardData.getData("text/plain");
      document.execCommand("insertHTML", false, text);
     });

  //-===================================================================================
  //- parse double click event listener
  //-===================================================================================
    var dblClicked;
    if (attrs.on != 'dblClick') {
      // works only for comments now;
      if (attrs.validation) {
        var user_email = angular.element($editable).scope().$parent.comment.user.email;
        if (user_email != $rootScope.user.email) {
          return;
        }else{
          $editable.attr('contenteditable',"true");
          $editable.addClass('editing')
        }
      }else{
        $editable.attr('contenteditable',"true");
        $editable.addClass('editing')
      }
      }else{
        $editable.on('dblclick', function(e){
        if (attrs.validation) {
          var user_email = angular.element($editable).scope().$parent.comment.user.email;
          if (user_email != $rootScope.user.email) {
            return;
          }else{
            $editable.attr('contenteditable',"true");
            $editable.addClass('editing')
          }
        };
        dblClicked = true
        $editable.attr('contenteditable',"true")
        // $editable.addClass('editing')
        $editable.trigger('click')
        $editable.focus();
      })
     }

  //-===================================================================================
  //- on cancel
  //-===================================================================================
    $editable.on('blur', function(){
      if (window.getSelection) {
        if (window.getSelection().empty) {  // Chrome
          window.getSelection().empty();
        } else if (window.getSelection().removeAllRanges) {  // Firefox
          window.getSelection().removeAllRanges();
        }
      } else if (document.selection) {  // IE?
        document.selection.empty();
      }
      $('.promt').remove();
      // if (enterPressed){
      //   enterPressed = false;

        if (attrs.on == 'dblClick') {
          $editable.attr('contenteditable',"false")
        }

        $editable.css({ "cursor": "pointer"  })
        editing = false;
        dblClicked = false;



        if (attrs.editCancel && !enterPressed) {
          scope.$apply(attrs.editCancel)
          enterPressed = false;
          return
        }

        if (!escaped && !enterPressed) {
          saveChanges();
        };

        enterPressed = false;
     })

  //-===================================================================================
  //- activate editting on click
  //-===================================================================================
    $editable.keydown(function (event) {
      var esc = event.which == 27,
          nl = event.which == 13;

      if (nl && event.shiftKey) {
        if (!attrs.editMultiline) {
          event.preventDefault();
        }
        return;
      }

      if (attrs.editMultiline) {
          if (esc) {
            $editable.blur();
            $editable.text(cache);

          } else if(nl ){
            event.preventDefault();
            $editable.blur();
          }
        }else{
          if (esc) {
            $editable.text(cache);
            $editable.blur();
          } else if(nl){
            event.preventDefault();
            enterPressed = true;
            if (attrs.editConfirm) {
              scope.$apply(attrs.editConfirm);
            }else{
              saveChanges();
            }
            $editable.blur();
          }
        }
      });

    $editable.keyup(function(event) {
      var nl = event.which == 13;
      if (nl && event.shiftKey) {
          event.stopPropagation();
      }
    });

  //-===================================================================================
  //- parse text
  //-===================================================================================
    $editable.on('click', function(event){
      if(event.target.tagName == "A"){
        event.preventDefault();
        $editable.blur()
        window.open(event.target.href, '_blank');
        return;
      }
      // works only for comments now;
      if (attrs.validation) {
        var user_email = angular.element(this).scope().$parent.comment.user.email;
        if (user_email != $rootScope.user.email) {
          return;
        };
      };
      if (attrs.on == 'dblClick' && !dblClicked) return;
      if (!editing) {
        if(attrs.promt) $editable.parent().append("<span class='promt' >"+attrs.promt+"</span>")
        editing = true
        cache = $editable.html()
        $editable.css({"cursor": "text"  })
        $editable.removeClass('.noselect');
        var doc = document, text = $editable[0]
        , range, selection;
        if (doc.body.createTextRange) {
            range = document.body.createTextRange();
            range.moveToElementText(text);
            range.select();
        } else if (window.getSelection) {
            selection = window.getSelection();
            range = document.createRange();
            range.selectNodeContents(text);
            selection.removeAllRanges();
            selection.addRange(range);
        }
      };
    })

    // attrs.$observe('editData', function(value) {
    //   var data = JSON.parse(value)
    //   var cords = $editable.position()
    //   data.text = data.text ? data.text : data.alt
    //   $editable.text(data.text)
    // });
        }
      }
    })