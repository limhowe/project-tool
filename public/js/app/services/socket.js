(function() {
  'use strict';

  /**
   * Service to deal with Socket.io connections.
   */
  angular
    .module('App.services')
    .service('socketService', socketService);

  socketService.$inject = ['$location'];

  function socketService($location) {
    var sockets = {};

    this.getSocket = getSocket;

    /**
     * Retrieve the active socket connection for the specified project.
     * If there is no active connection, establish a new one.
     * @param  {String} projectId
     * @return {Socket}
     */
    function getSocket(projectId) {
      if (!_.isUndefined(sockets[projectId])) {
        return sockets[projectId];
      }

      // Establish a new connection.
      var socket = io.connect($location.protocol() + '://' + $location.host() + ':' + $location.port(), {
        transports: ['websocket', 'polling', 'xhr-polling']
      });

      socket.on('connected', function () {
        // Send socket connection info to the server.
        socket.emit('socket.info', {
          socketId: socket.id,
          projectId: projectId,
        });

        // Save the connection for re-use later.
        sockets[projectId] = socket;
      });

      return socket;
    }
  }
})();
