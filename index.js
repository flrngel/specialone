require("waitjs")

var _ = require("underscore");
var async = require("async");
var fs = require("fs");
var Docker = require("dockerode");

var docker_socket = process.env.DOCKER_SOCKET || "/var/run/docker.sock";

var interval = process.env.SP_INTERVAL || 1000;
var kill_timeout = process.env.SP_KILL_TIMEOUT || 10;

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
    // Unserialize Env
    var hsh = {};
    for(var i in data.Config.Env){
      var index = data.Config.Env[i].indexOf("=");
      var key = data.Config.Env[i].substr(0, index);
      var val = data.Config.Env[i].substr(index + 1);

      hsh[key] = val;
    }
    data.Config.Env = hsh;

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
      var rejected_results = _.reject(results, function(result){
        return result.Config.Env.SP_GROUP == null;
      });

      // group by SP_GROUP
      var groups = _.groupBy(rejected_results, function(result){
        return result.Config.Env.SP_GROUP;
      });

      for(var key in groups ){
        var group = groups[key];

        // sort by created
        var sorted_group = _.sortBy(group, function(container){
          return container.Created;
        });

        // get container ids
        var container_ids = _.map(sorted_group, function(obj){
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
