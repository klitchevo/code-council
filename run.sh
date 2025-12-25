#!/bin/bash
cd /home/pho7on/Work/multi-agent
source .env
export OPENROUTER_API_KEY
exec node dist/index.js
