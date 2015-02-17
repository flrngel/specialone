require("waitjs")

var _ = require("underscore");
var async = require("async");
var fs = require("fs");
var Docker = require("dockerode");

var docker_socket = process.env.DOCKER_SOCKET || "/var/run/docker.sock";

var interval = process.env.SP_INTERVAL || 4000;
var kill_timeout = process.env.SP_KILL_TIMEOUT || 10;
var kill_wait = process.env.SP_KILL_WAIT || 3000;

var stats = fs.statSync(docker_socket);

if( !stats.isSocket() ){
  throw new Error("Docker is not running.");
}

var docker = new Docker({
  socketPath: docker_socket
});

var inspectContainer = function(containerInfo, callback){
  var container = docker.getContainer(containerInfo.Id);
  container.inspect(function(err, data){
    callback(null, data);
  });
};

var run = function(){
  docker.listContainers({
    all: false 
  }, function(err, containers){
    // get all runnning containers
    async.map(containers, inspectContainer, function(err, results){
      // reject all non-special containers
      results = _.reject(results, function(result){
        return result.Config.Env.SP_GROUP === null;
      });

      // group by SP_GROUP
      groups = _.groupBy(results, function(result){
        return result.Config.Env.SP_GROUP;
      });

      for(var key in groups ){
        var group = groups[key];
        
        // sort by created
        sorted_group = _.sortBy(group, function(container){
          return container.Created;
        });

        // get container ids
        container_ids = _.map(sorted_group, function(obj){
          return obj.Id;
        });

        // stop containers before the last one
        for(var i=0;i<container_ids.length-1;i++){
          var container = docker.getContainer(container_ids[i]);
          container.stop({t: kill_timeout}, function(error,data){})
        }
      }
    });
  });
};

repeat(interval, run);
