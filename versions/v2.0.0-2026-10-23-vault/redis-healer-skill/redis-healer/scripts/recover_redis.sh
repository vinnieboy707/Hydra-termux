#!/bin/bash
if ! pgrep -x "redis-server" > /dev/null
then
    echo "Redis not running. Attempting to start..."
    # Attempting to start redis, assuming a common binary path or service
    redis-server --daemonize yes
    sleep 2
    if pgrep -x "redis-server" > /dev/null
    then
        echo "Redis successfully started."
    else
        echo "Failed to start Redis. Check installation."
    fi
else
    echo "Redis is already running."
fi
