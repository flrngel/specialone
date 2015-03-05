# Specialone

unique docker container with etcd service discovery.

## Concept

kills old container with same `SP_GROUP` environment

## Usage

on build

`sudo docker build -t flrngel/specialone .`

running daemon

`sudo docker run -d -v /var/run/docker.sock:/var/run/docker.sock flrngel/specialone`

environments

- `SP_INTERVAL` - miliseconds interval to check containers
- `SP_KILL_WAIT` - waiting seconds to kill before on `docker stop`
- `SP_KILL_TIMEOUT` - seconds to kill after timeout on `docker stop`
- `SP_ETCD_HOST` - etcd host `ex) 127.0.0.1:4001`
- `SP_ETCD_TTL` - TTL for etcd keys

to group container, give docker environment as

- `SP_GROUP` - specialone will kill old containers with same group name
- `SP_KILL_WAIT` - overwrite waiting seconds to kill before on `docker stop`
- `SP_KILL_TIMEOUT` - overwrite seconds to kill after timeout on `docker stop`

## Example

```
$ sudo docker run -d -v /var/run/docker.sock:/var/run/docker.sock flrngel/specialone
c9c334b73d20a9b6e1ae7c99abe36a0892f38661b5c4f1d9ca3985aff2cb8a4a

$ sudo docker run -d --name old -e SP_GROUP=redis redis:2.8.10
184ccc2879abf63b0ba87ec9d43ea3e2b088449656220912d01eba2bb1e9686f

$ sudo docker ps
CONTAINER ID        IMAGE                       COMMAND                CREATED             STATUS              PORTS               NAMES
184ccc2879ab        redis:2.8.10                "/entrypoint.sh redi   3 seconds ago       Up 2 seconds        6379/tcp            old                 
c9c334b73d20        flrngel/specialone:latest   "npm start"            18 seconds ago      Up 17 seconds                           pensive_lalande     

$ sudo docker run -d --name new -e SP_GROUP=redis redis:2.8.12
bf54222669f92e167ecbacaa2f1cb0f4aa2740788d89486b0ce1c9a3ba085769

$ sudo docker ps
CONTAINER ID        IMAGE                       COMMAND                CREATED              STATUS              PORTS               NAMES
bf54222669f9        redis:2.8.12                "/entrypoint.sh redi   2 seconds ago        Up 1 seconds        6379/tcp            new                 
c9c334b73d20        flrngel/specialone:latest   "npm start"            About a minute ago   Up About a minute                       pensive_lalande     
```

## ETCD

- groups are in `sp/` as `sp/<SP_GROUP>`
- ip is in `sp/<SP_GROUP>/<CONTAINER_ID>/ip`
- port keys are in `sp/<SP_GROUP>/<CONTAINER_ID>/ports/`

## TODO

- logging
- haproxy for port-exposed containers
