#! /bin/bash

gcloud compute instances list --quiet --project="$1" --format=json