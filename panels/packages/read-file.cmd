#! /bin/bash
arg=`echo $1 | base64 -d`
zless $arg
