#!/bin/bash

# Run Celeste and restart it whenever it stops.
# Direct logs to ./logs/out.log

LOG_DIR="./logs"
mkdir -p "$LOG_DIR"

rm -f "$LOG_DIR/out.log"

while true; do
    echo "Starting Celeste..."
    ./celeste/Celeste 2>&1 | tee -a "$LOG_DIR/out.log"
    
    echo "Celeste stopped. Restarting in 2 seconds"
    sleep 2
done