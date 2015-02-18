# Specialone

Zero-downtime for docker containers.

## Concept

kills old container with same `SP_GROUP` environment

## Usage

running daemon

`sudo docker run -d -v /var/run/docker.sock:/var/run/docker.sock flrngel/specialone`

environments

- `SP_INTERVAL` - miliseconds interval to check containers

- `SP_KILL_TIMEOUT` - seconds to kill after timeout on `docker stop`

to group container, give docker environment as

- `SP_GROUP` - specialone will kill old containers with same group name
