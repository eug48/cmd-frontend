#! /usr/bin/python3
# Review and run this script in dom0 to enable the qube with cmd-frontend to execute certain commands in dom0

import os
import stat

qubes_to_allow = [
    # Change if required
    "cmd-frontend"
]

commands = [
    ('lvs', '/sbin/lvs'),
    ('pvs', '/sbin/pvs -a'),
    ('qvm-ls', 'qvm-ls --no-spinner --fields NAME,STATE,CLASS,LABEL,TEMPLATE,IP,NETVM,DISK,PRIV-CURR,PRIV-MAX,ROOT-CURR,ROOT-MAX'),
    ('xentop', 'xentop --delay=1  --batch --iterations=3 --full-name'),
]

file_prefix = "cmd-frontend."

qubes_rpc_dir = "/etc/qubes-rpc/"
qubes_rpc_policy_dir = "/etc/qubes-rpc/policy"
qubes_rpc_policy_include_dir = "/etc/qubes-rpc/policy/include"

print("Deleting existing files")

for dirpath in [qubes_rpc_dir, qubes_rpc_policy_dir, qubes_rpc_policy_include_dir]:
    for filename in os.listdir(dirpath):
        if filename.startswith(file_prefix):
            filepath = os.path.join(dirpath, filename)
            #print("  deleting", filepath)
            os.unlink(filepath)

print()

for (name, command) in commands:
    # write command file
    command_filepath = os.path.join(qubes_rpc_dir, file_prefix + name)
    with open(command_filepath, "w") as f:
        print("Allowing", command)
        f.write("#! /bin/bash\n")
        f.write(command)
        f.write("\n")
    
    # set executable bit
    st = os.stat(command_filepath)
    os.chmod(command_filepath, st.st_mode | stat.S_IEXEC)

    # write policy file
    policy_filepath = os.path.join(qubes_rpc_policy_dir, file_prefix + name)
    with open(policy_filepath, "w") as f:
        #print("  writing", policy_filepath)
        f.write("$include:include/" + file_prefix + "include\n")

# write policy include file
print()
policy_include_filepath = os.path.join(qubes_rpc_policy_include_dir, file_prefix + "include")
with open(policy_include_filepath, "w") as f:
    #print("  writing", policy_include_filepath)
    for qube in qubes_to_allow:
        print("Allowing running from", qube)
        f.write(qube + " dom0 allow,user=root\n")
