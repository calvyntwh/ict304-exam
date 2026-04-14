#!/bin/bash
# Start ICT304 Concept Explorer on port 8080
cd "$(dirname "$0")"
exec caddy file-server --browse --port 8080
