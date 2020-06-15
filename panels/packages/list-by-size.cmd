#! /bin/bash
set -e

if [ -x "$(command -v dpkg-query)" ]
then
    dpkg-query --show --showformat='>>>${Installed-Size}\t${Package}\t${Version}\t${Architecture}\t${Description}\n'
    exit 0
fi

if [ -x "$(command -v rpm)" ]
then
    rpm -qa --queryformat '>>>%{SIZE}\t%{NAME}\t%{VERSION}\t%{ARCH}\t%{SUMMARY}\n%{DESCRIPTION}\n'
    exit 0
fi
