#! /bin/bash

# hack to encode non-alpha characters to get past ensureSimpleString
url=`echo $1 | tr '123' ':/.'`

boinccmd --project "$url" "$2"