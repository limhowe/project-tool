'use strict';

angular
.module('App.controllers')
.controller('ProjectGanttController',
  ['$scope', '$rootScope', '$stateParams', '$timeout', '$i18next', 'Project', 'DateFormat', 'Node', 'User', 'socketService',
  function ($scope, $rootScope, $stateParams, $timeout, $i18next, Project, DateFormat, Node, User, socketService) {

  $scope.taskCache = [];
  $scope.height = window.innerHeight - 80;

  $scope.parseDeps = function (dep) {
    switch (dep.type) {
      case 3:
        return 'SS';
      case 2:
        return 'SF';
      case 1:
        return 'FS';
      case 0:
        return 'FF';
    }
    return '';
  };

  $scope.parseToDeps = function (dep) {
    switch (dep.type) {
      case 'SS':
        return 3;
      case 'FS':
        return 1;
      case 'SF':
        return 2;
      case 'FF':
        return 0;
    }
    return 0;
  };

  $scope.randomI = function () {
    return function () {
      return Math.round(Math.random() * 1000000);
    };
  };

  $scope.dealWithId = function (id) {
    if (!$scope.taskCache || !$scope.taskCache.length) {
      return id;
    }

    var result = id;
    _.each($scope.taskCache, function (_task) {
      if (_task.id == id) {
        result = _task._id;
      }
    });
    return result;
  };

  function createGanttNode(event) {
    if (event.dependency) {
      Node.addDependency(
        $scope.dealWithId(event.dependency.successorId),
        $scope.dealWithId(event.dependency.predecessorId),
        $scope.parseDeps(event.dependency)
      );
    }

    // if task is added
    if (!event.dependency && event.task) {
      var task = event.task;
      var node = {
        title: task.title
      };

      var parentId = event.task.parentId ? $scope.dealWithId(event.task.parentId) : null;

      Node
        .add($scope.project._id, parentId, node)
        .then(function (data) {
          $scope.taskCache.push({
            id: task.id,
            _id: data._id
          });
        });
    }
  }

  function deleteGanttTask(e) {
    if (e.dependencies && !e.task) {
      var dep = e.dependencies[0];
      Node
        .deleteDependency($scope.dealWithId(dep.successorId), $scope.dealWithId(dep.predecessorId), $scope.parseDeps(dep))
        .catch(function (error) {
          $rootScope.$broadcast('dependency_deleted', e);
        });
    } else {
      Node
        .delete($scope.dealWithId(e.task.id))
        .then(function (item) {
          $rootScope.$broadcast('task_deleted', e.task);
        });
    }
  }

  function updateGanttTask(e) {
    if (e.values.parentId) {
      Node.updateParent($scope.dealWithId(e.task.id), e.values.parentId);
    }

    Node.ganttDateUpdate($scope.dealWithId(e.task.id), e.task);

    Node.update($scope.dealWithId(e.task.id) , {
      title: e.values.title ? e.values.title : e.task.title,
      start_date: e.values.start ? e.values.start : e.task.start,
      end_date: e.values.end ? e.values.end : e.task.end,
      complete: e.values.percentComplete ? e.values.percentComplete * 100 : e.task.percentComplete * 100,
    });
  }

  function generateKendoData(nodes) {

    var kendoData = [];
    var kendoDependencyData = [];
    var kendoColorGroup = [];

    var vertexList = [];
    var vertexMap = [];

    function recursion(nodes, parentId) {
      _.each(nodes, function (node) {
        if (node._state && node._state.length) {
          _.each(node._state, function (state) {
            if (state.user == $scope.user) {
              node.isList = state.isList;
              node.isListParent = state.isListParent;
              node.collapsed = state.collapsed;
            }
          });
        }

        //==== node dependency data
        if (node._dependency && node._dependency.length) {
          _.each(node._dependency, function (dep) {
            if (!dep.node) {
              return;
            }

            kendoDependencyData.push({
              id: dep._id,
              predecessorId: dep.node._id,
              successorId: node._id,
              type: $scope.parseToDeps(dep),
            });

            //add node to Vertex List

            var preVerTex = _.indexOf(vertexList, dep.node._id);
            if (preVerTex == -1) {
              preVerTex = vertexList.length;
              vertexList.push(dep.node._id);
            }

            var nextVerTex = _.indexOf(vertexList, node._id);
            if (nextVerTex == -1) {
              nextVerTex = vertexList.length;
              vertexList.push(node._id);
            }
          });
        }

        //==== node data
        kendoData.push({
          id: node._id,
          parentId: parentId ? parentId : null,
          title: node.title,
          start: node.start_date,
          end: node.end_date,
          summary: node._nodes && node._nodes.length ? true : false,
          expanded: node.collapsed ? false : true,
          percentComplete: node.complete / 100,
          dependency: node.dependency,
          orderId: node.level
        });

        if (node._nodes && node._nodes.length) {
          recursion(node._nodes, node._id);
        }
      });
    }
    recursion(nodes, null);


    function calcCriticalPath() {
      //Create Vertex Map

      var vertexListLength = vertexList.length;
      _.each(vertexList, function(v) {
        var row = new Array(vertexListLength);
        _.each(row,function(col,index) {
          row[index] = 0;
        });

        vertexMap.push(row);
      })

      //Initialize Vertex Map
      _.each(kendoDependencyData, function (depNode) {

        var preVerTex = _.indexOf(vertexList, depNode.predecessorId);
        var nextVerTex = _.indexOf(vertexList, depNode.successorId);

        if (preVerTex == -1 || nextVerTex == -1) {
          console.log('Error !!!', depNode, vertexList, nextVerTex);
        } else {
          vertexMap[preVerTex][nextVerTex] = 1;
        }
      });

      var visited = Array(vertexList.length);
      _.each(visited, function(v,index) {
        visited[index] = false;
      });

      var stack = [];

      getAllPaths();

      function getAllPaths() {

        stack.length = 0;
        var longPath = '';
        while ((longPath = longestPath()).length > 2) {
          var indices = longPath.split(',');
          indices.splice(0,1);

          // New color Group;
          var newGroup = [];
          _.each(indices, function(v) {
            newGroup.push(vertexList[v]);

            vertexList.splice(v,1);
            vertexMap.splice(v,1);
            visited.splice(v,1);
            _.each(vertexMap,function(row,index) {
              vertexMap[index].splice(v,1);
            });

          });

          if (newGroup.length > 0) {
            kendoColorGroup.push( {
              level: kendoColorGroup.length,
              nodes: newGroup
            });
          }
        }
      }

      function recursiveMapHelper(v,path) {
        var row = vertexMap[v];

        _.each(row,function(col,index) {

          if (col && !visited[index]) {
            visited[index] = true;
            var newPath = path + ',' + v;
            recursiveMapHelper(index,newPath);
            visited[index] = false;
          }
        });

        var newPath = path + ',' +v;
        stack.push(newPath);
      }

      function longestPath() {
        stack.length = 0;

        _.each(vertexList,function(v,index) {
          recursiveMapHelper(index,'');
        });

        var longPath = _.max(stack, function(o) {
          return o.length;
        });

        return longPath;
      }
    }

    calcCriticalPath();

    return {
      kendoData: kendoData,
      kendoDependencyData: kendoDependencyData,
      kendoColorGroup: kendoColorGroup
    };

  }

  function initGantt() {
    localizeGantt();

    Node
      .getList($stateParams.id)
      .then(function (nodes) {
        $scope.nodes = nodes;

        if ($scope.nodes.length) {
          $scope.project.first_task_start_date = $scope.nodes[0].start_date;
        }

        var kendoNodes = generateKendoData(nodes);
        $scope.kendoNodes = kendoNodes;

        var tasksDataSource = new kendo.data.GanttDataSource({
          schema: {
            model: {
              id: 'id',
              fields: {
                id: {
                  from: "id",
                  type: "string",
                  defaultValue: $scope.randomI()
                },
                start: {
                  from: "start",
                  type: "date"
                },
                end: {
                  from: "end",
                  type: "date"
                },
                title: {
                  from: "title",
                  defaultValue: "",
                  type: "string"
                },
                percentComplete: {
                  from: "percentComplete",
                  type: "number"
                },
                parentId: {
                  from: "parentId",
                  type: "string",
                  defaultValue: null,
                  validation: {
                    required: true
                  }
                }
              }
            }
          },
          data: kendoNodes.kendoData
        });

        var dependenciesDataSource = new kendo.data.GanttDependencyDataSource({
          schema: {
              model: {
                fields: {
                    id: {
                      from: "id",
                      type: "number"
                    },
                    predecessorId: {
                      from: "predecessorId",
                      type: "string"
                    },
                    successorId: {
                      from: "successorId",
                      type: "string"
                    },
                    type: {
                      from: "type",
                      type: "number"
                    }
                }
              }
          },
          data: kendoNodes.kendoDependencyData
        });

        function onEdit(e) {
          if ($('.k-input')[0].name === 'title') {
            if (e.task.title === 'New task') {
              $('.k-input')[0].value = '';
              $('.k-input')[0].placeholder = $i18next('ganttView.newTask');
            }
          }
        }

function getGanttStartDate() {
  var d = new Date();
  d.setHours(0,0,0,0); // CURRENT_DATE is default value

  if ($scope.project.settings.gantt_start_date=='PROJECT_CREATION_DATE') {
    d = new Date( $scope.project.created_at );
    d.setHours(0,0,0,0);
  }

  if ($scope.project.settings.gantt_start_date=='FIRST_TASK_START_DATE' && $scope.project.first_task_start_date) {
    d = new Date( $scope.project.first_task_start_date );
    d.setHours(0,0,0,0);
  }

  return d;
}

            kendo.ui.GanttCustomDay = kendo.ui.GanttDayView.extend({
                name: "customDay",

                  range: function(range) {
                    this.start = getGanttStartDate();
                    this.end = (function(){ var d = new Date(); d.setTime( d.getTime() + 90 * 86400000 ); d.setHours(0,0,0,0); return d; })();
                  },
            });

            kendo.ui.GanttCustomWeek = kendo.ui.GanttWeekView.extend({
                name: "customWeek",

                  range: function(range) {
                    this.start = getGanttStartDate();
                    this.end = (function(){ var d = new Date(); d.setTime( d.getTime() + 365 * 86400000 ); d.setHours(0,0,0,0); return d; })();
                  },
            });

            kendo.ui.GanttCustomMonth = kendo.ui.GanttMonthView.extend({
                name: "customMonth",

                  range: function(range) {
                    this.start = getGanttStartDate();
                    this.end = (function(){ var d = new Date(); d.setTime( d.getTime() + 730 * 86400000 ); d.setHours(0,0,0,0); return d; })();
                  },
            });

        kendo.culture(DateFormat.getFormat($scope.project.dateformat).value);

        $("#gantt").kendoGantt({
          dataSource: tasksDataSource,
          dependencies: dependenciesDataSource,
          views: [
            { type: "kendo.ui.GanttCustomDay", title: $i18next('ganttView.day') },
            { type: "kendo.ui.GanttCustomWeek", title: $i18next('ganttView.week'), selected: true },
            { type: "kendo.ui.GanttCustomMonth", title: $i18next('ganttView.month') }
          ],
          columns: [
            {
              field: 'title',
              title: $i18next('ganttView.title'),
              editable: true,
              width: 30
            }
          ],
          edit: onEdit,
          height: $scope.height,
          showWorkHours: false,
          showWorkDays: false,
          add: createGanttNode,
          remove: deleteGanttTask,
          save: updateGanttTask,
          dataBound: function() {
            var gantt = this;

            var colorGroups = $scope.kendoNodes.kendoColorGroup;
            if (colorGroups.length > 0) {

              gantt.element.find(".k-task").each(function(e) {
                var dataItem = gantt.dataSource.getByUid($(this).attr("data-uid"));
                var that = this;

                _.each(colorGroups, function (group) {
                  var colorGroup = group.nodes;
                  var level = group.level;
                  if (_.indexOf(colorGroup, dataItem.id) != -1) {
                    // colorize task per group level
                    var bgColor = "#"+(255-parseInt(level)*30).toString(16)+"9999";
                    var colorComplete = "#"+(226-parseInt(level)*30).toString(16)+"4557";
                    that.style.backgroundColor = bgColor;
                    $(that).find(".k-task-complete").css("background-color", colorComplete);
                    $(that).find(".k-task-summary-complete").css({"background-color": colorComplete, "border-color": colorComplete});
                  }
                })
              });
            }

            //Scroll to view
            var view = gantt.view();
            if (view.title == 'week') {
              var date = (function(){ var d = new Date(); d.setHours(0,0,0,0); return d; })();
                var slots = view._slots[1];

                for (var i = 0; i < slots.length; i++) {
                    var slot = slots[i];
                    if (slot.start.getTime() >= targetDate.getTime()) {
                        $('.k-timeline .k-grid-content').scrollLeft(slot.offsetLeft);
                        break;
                    }
                }

            }

          }
        });

        $timeout(function () {
          $(".k-item:contains('Add Above')").remove();
          $(".k-item:contains('Add Below')").remove();
        }, 500);
      });
  }

  /**
   * Localize the Gantt view.
   */
  function localizeGantt() {
    kendo.ui.Gantt.prototype.options.messages =
      $.extend(true, kendo.ui.Gantt.prototype.options.messages, {
        "actions": {
          "addChild": $i18next('ganttView.addChild'),
          "append": $i18next('ganttView.addTask'),
          "insertAfter": "Add Below",
          "insertBefore": "Add Above",
          "pdf": "Export to PDF"
        },
        "cancel": $i18next('ganttView.cancel'),
        "deleteDependencyWindowTitle": "Delete dependency",
        "deleteTaskWindowTitle": $i18next('ganttView.deleteTask'),
        "destroy": $i18next('ganttView.delete'),
        "editor": {
          "assingButton": "Assign",
          "editorTitle": $i18next('ganttView.task'),
          "end": $i18next('ganttView.end'),
          "percentComplete": $i18next('ganttView.complete'),
          "resources": "Resources",
          "resourcesEditorTitle": "Resources",
          "resourcesHeader": "Resources",
          "start": $i18next('ganttView.start'),
          "title": $i18next('ganttView.title'),
          "unitsHeader": "Units"
        },
        "save": $i18next('ganttView.save'),
        "views": {
          "day": $i18next('ganttView.day'),
          "end": $i18next('ganttView.end'),
          "month": $i18next('ganttView.month'),
          "start": $i18next('ganttView.start'),
          "week": $i18next('ganttView.week'),
          "year": $i18next('ganttView.year')
        },
        "deleteTaskConfirmation": $i18next('ganttView.confirmDelete'),
      });
  }



  function updateGantt() {

    Node
      .getList($stateParams.id)
      .then(function (nodes) {
        $scope.nodes = nodes;

        var kendoNodes = generateKendoData(nodes);
        $scope.kendoNodes = kendoNodes;

        var tasksDataSource = new kendo.data.GanttDataSource({
          schema: {
            model: {
              id: 'id',
              fields: {
                id: {
                  from: "id",
                  type: "string",
                  defaultValue: $scope.randomI()
                },
                start: {
                  from: "start",
                  type: "date"
                },
                end: {
                  from: "end",
                  type: "date"
                },
                title: {
                  from: "title",
                  defaultValue: "",
                  type: "string"
                },
                percentComplete: {
                  from: "percentComplete",
                  type: "number"
                },
                parentId: {
                  from: "parentId",
                  type: "string",
                  defaultValue: null,
                  validation: {
                    required: true
                  }
                }
              }
            }
          },
          data: kendoNodes.kendoData
        });

        var dependenciesDataSource = new kendo.data.GanttDependencyDataSource({
          schema: {
              model: {
                fields: {
                    id: {
                      from: "id",
                      type: "number"
                    },
                    predecessorId: {
                      from: "predecessorId",
                      type: "string"
                    },
                    successorId: {
                      from: "successorId",
                      type: "string"
                    },
                    type: {
                      from: "type",
                      type: "number"
                    }
                }
              }
          },
          data: kendoNodes.kendoDependencyData
        });

        var gantt = $("#gantt").data("kendoGantt");
        if (gantt) {
          gantt.setDataSource(tasksDataSource);
          gantt.setDependenciesDataSource(dependenciesDataSource);
        }

      });
  }

  // Called when the project details is fetched.
  $scope.$on('project_fetched', onProjectFetched);

  function onProjectFetched() {
    $scope.project = $rootScope.project;

    $scope.user = $scope.project._user;
    $scope.refreshTree();

    initGantt();

    User.me().then(function(user){
      $scope.userId = user._id;
    });

    // Establish a socket connection.
    var socket = socketService.getSocket($scope.project._id);

    // Socket.io event handlers.
    socket.on('task.create', function(info) {
      if (info.userId == $scope.userId) {
        return;
      }

      updateGantt();
    });

    socket.on('task.update', function(info) {
      if (info.userId == $scope.userId) {
        return;
      }

      updateGantt();
    });

    socket.on('task.delete', function(info) {
      if (info.userId == $scope.userId) {
        return;
      }

      updateGantt();
    });

  }

  if ($scope.project) {
    $scope.refreshTree();
    initGantt();
  }

}]);
