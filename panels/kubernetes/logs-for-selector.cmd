#! /bin/bash
kubectl -n $1 logs -l $2=$3 --tail=10000
