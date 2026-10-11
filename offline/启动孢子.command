#!/bin/zsh
set -eu
spore_package_dir="${0:A:h}"
exec "$spore_package_dir/离线启动器" "$spore_package_dir/胞子离线版.html" "$@"
