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
# A real firmware has no UEFI shell to run startup.nsh, so install GRUB at the removable-media fallback path
# (EFI/BOOT/BOOTX64.EFI or BOOTAA64.EFI) that every UEFI firmware, VirtualBox and the Raspberry Pi UEFI build boot.
apk add --no-cache grub-efi
case "$(uname -m)" in
	x86_64) target=x86_64-efi serial=ttyS0 ;;
	aarch64) target=arm64-efi serial=ttyAMA0 ;;
esac
root_uuid=$(awk '$2 == "/" { sub("UUID=", "", $1); print $1 }' /etc/fstab)
grub-install --target="$target" --efi-directory=/boot --boot-directory=/boot --removable --no-nvram
flavor=$(ls /boot/vmlinuz-* | head -n1 | sed 's#/boot/vmlinuz-##')
cat > /boot/grub/grub.cfg <<GRUB
set timeout=1
menuentry "Material OpenCode" {
	linux /vmlinuz-$flavor root=UUID=$root_uuid rootfstype=ext4 modules=ext4,kms,scsi,virtio console=tty0 console=$serial,115200
	initrd /initramfs-$flavor
}
GRUB

if [ -f /mnt/image.tar.zst ]; then cp /mnt/image.tar.zst /opt/material-opencode/image.tar.zst; fi
