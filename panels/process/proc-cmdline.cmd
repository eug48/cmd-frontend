#! /bin/bash

strings "/proc/$1/cmdline" | paste --serial -d" "
