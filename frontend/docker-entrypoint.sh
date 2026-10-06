#!/bin/sh
set -eu
cd /app
npm install
exec npm run dev
