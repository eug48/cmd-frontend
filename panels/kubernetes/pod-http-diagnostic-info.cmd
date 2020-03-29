#! /bin/bash
kubectl -n $1 exec $2 -- curl --silent --show-error http://localhost:2000/d/$3 
