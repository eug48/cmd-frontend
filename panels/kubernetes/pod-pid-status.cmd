#! /bin/bash
kubectl -n $1 exec $2 -- cat /proc/$3/status
