#!/usr/bin/env sh
# Builds the Material OpenCode appliance: a minimal Alpine Linux disk image that boots straight into Docker and runs
# the OpenCode web app container. Needs root (it attaches the image with qemu-nbd).
#
#   sudo appliance/build.sh x86_64  dist/image-amd64.tar  dist/appliance
#   sudo appliance/build.sh aarch64 dist/image-arm64.tar  dist/appliance          (generic arm64 UEFI)
#   sudo appliance/build.sh aarch64 dist/image-arm64.tar  dist/appliance --pi     (adds Raspberry Pi 4/400 UEFI firmware)
#
# Outputs <out>/material-opencode-<arch>[-pi].img (raw, for USB/SD flashing) and, for x86_64, a .vdi for VirtualBox.
set -eu
arch="$1"; image_tar="$2"; out="$3"; pi="${4:-}"
here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

amvi_version=v0.13.1
amvi_sha256=b6435853533e8c47c6a9d6b15140e5371ad8892f4c509f6c5994c482f00cfd71
curl -fsSL -o "$work/alpine-make-vm-image" "https://raw.githubusercontent.com/alpinelinux/alpine-make-vm-image/${amvi_version}/alpine-make-vm-image"
echo "${amvi_sha256}  $work/alpine-make-vm-image" | sha256sum -c -
chmod +x "$work/alpine-make-vm-image"

# The configure script reads the baked image from the directory it is run from.
cp "$here/configure.sh" "$work/configure.sh"
zstd -q -19 -T0 "$image_tar" -o "$work/image.tar.zst"

suffix=""
[ "$pi" = "--pi" ] && suffix="-pi"
mkdir -p "$out"
img="$out/material-opencode-${arch}${suffix}.img"
boot=BIOS
[ "$arch" = "aarch64" ] && boot=UEFI

"$work/alpine-make-vm-image" \
  --arch "$arch" \
  --boot-mode "$boot" \
  --branch v3.22 \
  --image-format raw \
  --image-size 6G \
  --kernel-flavor "$([ "$arch" = aarch64 ] && echo lts || echo virt)" \
  --packages "docker docker-cli-compose zstd curl openssh iproute2 ca-certificates chrony" \
  --fs-skel-dir "$here/rootfs" \
  --fs-skel-chown root:root \
  --serial-console \
  --script-chroot \
  "$img" "$work/configure.sh"

if [ "$pi" = "--pi" ]; then
  # Raspberry Pi 4/400 boot through the community UEFI firmware placed on the EFI system partition.
  fw_version=v1.38
  curl -fsSL -o "$work/rpi4-uefi.zip" "https://github.com/pftf/RPi4/releases/download/${fw_version}/RPi4_UEFI_Firmware_${fw_version}.zip"
  loop=$(losetup --find --show --partscan "$img")
  mkdir -p "$work/esp"
  mount "${loop}p1" "$work/esp"
  unzip -o -q "$work/rpi4-uefi.zip" -d "$work/esp"
  umount "$work/esp"
  losetup -d "$loop"
fi

if [ "$arch" = "x86_64" ]; then
  qemu-img convert -O vdi "$img" "${img%.img}.vdi"
fi
sha256sum "$img" > "$img.sha256"
echo "Built $img"
