#!/usr/bin/env node

var _ = require("underscore");
var async = require("async");
var fs = require("fs");
var Docker = require("dockerode");
var Etcd = require('node-etcd');

var docker_socket = process.env.DOCKER_SOCKET || "/var/run/docker.sock";

// Basic configuration
var interval = process.env.SP_INTERVAL || 1000;
var kill_timeout = process.env.SP_KILL_TIMEOUT || 1000;
var kill_wait = process.env.SP_KILL_WAIT || interval * 10;

// ETCD configuration
var etcd_host = process.env.SP_ETCD_HOST ? process.env.SP_ETCD_HOST.toString().split(',') : false;
var etcd_ttl = process.env.SP_ETCD_TTL || interval / 1000 * 5;

// Get local ip
var os = require('os');

var interfaces = os.networkInterfaces();
var addresses = [];
for (var k in interfaces) {
  for (var k2 in interfaces[k]) {
    var address = interfaces[k][k2];
    if (address.family === 'IPv4' && !address.internal) {
      addresses.push(address.address);
    }
  }
}

var this_ip = addresses[0];

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

var swap_ids = {};
var stale_ids = {};

var run = function(){
  docker.listContainers({
    all: false 
  }, function(err, containers){
    if(containers === null){
      return;
    }

    // get all runnning containers
    async.map(containers, inspectContainer, function(err, results){
      // reject all non-special containers
      var rejected_results = _.reject(results, function(element){
        return element.Config.Env.SP_GROUP == null;
      });

      // group by SP_GROUP
      var groups = _.groupBy(rejected_results, function(element){
        return element.Config.Env.SP_GROUP;
      });

      for(var key in groups ){
        var group = groups[key];

        // sort by created
        var sorted_group = _.sortBy(group, function(container){
          return container.Created;
        });

        if( etcd_host !== false ){
          // register on ETCD
          for(var i=0;i<sorted_group.length;i++){
            // list NetworkSetting
            exposed_info = _.map(sorted_group[i].NetworkSettings.Ports, function(val, key){
              if( key.indexOf("/tcp") == -1 ) return -1;
              if( val == null ) return -1;
              return val[0].HostPort;
            });

            // reject non-TCP
            exposed_info = _.reject(exposed_info, function(element){
              return element == -1;
            });

            // parseInt
            exposed_tcp_ports = _.map(exposed_info, function(element){
              return parseInt(element).toString();
            });

            // Set
            var etcd = new Etcd(etcd_host);
            for(var j=0;j<exposed_tcp_ports.length;j++){
              // ports exposed
              if( stale_ids[sorted_group[i].Id] == true ) continue;
              etcd.set("sp/" + key + "/" + this_ip + ":" + exposed_tcp_ports[j], sorted_group[i].Id, { ttl: etcd_ttl });
            }
          }
        }

        // get container ids
        var container_ids = _.map(sorted_group, function(element){
          return element.Id;
        });

        // stop containers before the last one
        for(var i=0;i<container_ids.length-1;i++){
          // skip if it is already registered
          if( swap_ids[container_ids[i]] == true ) continue;

          var container = docker.getContainer(container_ids[i]);
          if( sorted_group[i].Config.Env.SP_NO_KILL == "true" ) continue;

          // override kill environments from container
          var container_kill_timeout = sorted_group[i].Config.Env.SP_KILL_TIMEOUT || kill_timeout;
          var container_kill_wait = sorted_group[i].Config.Env.SP_KILL_WAIT || kill_wait;

          // wait until container_kill_wait 
          (function(container, container_kill_wait, container_kill_timeout){
            setTimeout(function(){
              if( swap_ids[container["id"]] == true ) return;
              container.stop({t: kill_timeout}, function(error,data){
              // register
                swap_ids[container["id"]] = true;
                delete stale_ids[container["id"]];
              });
            }, container_kill_wait);
          })(container, container_kill_wait, container_kill_timeout);
          stale_ids[container_ids[i]] = true;
        }
      }
    });
  });
};

setInterval(run, interval);
