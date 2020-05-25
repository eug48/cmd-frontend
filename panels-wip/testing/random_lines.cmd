#! /bin/bash

COUNT=$((1 + RANDOM % 10))

for i in $(seq 1 $COUNT)
do
    uuidgen
done