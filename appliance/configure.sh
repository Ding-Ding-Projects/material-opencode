#!/bin/sh
# Runs inside the image (chroot) while alpine-make-vm-image builds it.
set -eu
rc-update add docker default
rc-update add local default
rc-update add material-opencode default
rc-update add networking boot
rc-update add sshd default
cat > /etc/network/interfaces <<'NET'
auto lo
iface lo inet loopback

auto eth0
iface eth0 inet dhcp
NET
echo material-opencode > /etc/hostname
# Root logs in on the console only; SSH requires a key the owner adds.
passwd -d root
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
if [ -f /mnt/image.tar.zst ]; then cp /mnt/image.tar.zst /opt/material-opencode/image.tar.zst; fi
