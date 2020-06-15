#! /bin/bash
if [ -x "$(command -v dpkg-query)" ]
then
    dpkg-query --listfiles $1 | xargs stat --format="%f %n %s"
    exit 0
fi

if [ -x "$(command -v rpm)" ]
then
    rpm -qa --list $1  | xargs stat --format="%f %n %s" 2>&1
    exit 0
fi
