#! /bin/bash

# this relies on the metrics-server
kubectl get --raw /apis/metrics.k8s.io/v1beta1/pods 