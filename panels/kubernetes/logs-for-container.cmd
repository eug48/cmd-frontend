#! /bin/bash
kubectl -n $1 logs $2 -c $3
