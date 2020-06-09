#! /bin/bash
kubectl api-resources --verbs=list -o wide
# kubectl api-resources --verbs=list -o name # | xargs -n 1 kubectl get -o name

