#! /bin/bash
dpkg-query --listfiles $1 | xargs stat --format="%f %n %s"
