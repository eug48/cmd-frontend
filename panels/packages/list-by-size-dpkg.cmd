#! /bin/bash
dpkg-query --show --showformat='>>>${Installed-Size}\t${Package}\t${Architecture}\t${Description}\n'
