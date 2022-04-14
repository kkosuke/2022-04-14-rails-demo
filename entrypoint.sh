#!/bin/bash
set -e

rm -f /demo/tmp/pids/server.pid

exec "$@"