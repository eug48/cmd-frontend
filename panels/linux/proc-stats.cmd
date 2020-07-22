#! /bin/bash

find /proc -maxdepth 1 -regex '.*[0-9]+' -printf "/proc/%f/stat\n" | xargs cat 2>/dev/null

exit 0

