#!/usr/bin/env sh
# Boots an appliance image in QEMU with port 4096 forwarded and waits until the web app answers.
#   appliance/boot-test.sh x86_64  dist/appliance/material-opencode-x86_64.img
#   appliance/boot-test.sh aarch64 dist/appliance/material-opencode-aarch64.img
set -eu
arch="$1"; img="$2"; timeout_s="${3:-900}"
work=$(mktemp -d)
cp "$img" "$work/disk.img"
log="$work/serial.log"
if [ "$arch" = "x86_64" ]; then
  accel=tcg; [ -w /dev/kvm ] && accel=kvm
  qemu-system-x86_64 -machine accel=$accel -m 2048 -smp 2 -nographic \
    -drive file="$work/disk.img",format=raw,if=virtio \
    -netdev user,id=n0,hostfwd=tcp::14096-:4096 -device virtio-net-pci,netdev=n0 >"$log" 2>&1 &
else
  firmware=$(ls /usr/share/AAVMF/AAVMF_CODE.fd /usr/share/qemu-efi-aarch64/QEMU_EFI.fd 2>/dev/null | head -n1)
  accel=tcg; cpu=max; [ "$(uname -m)" = aarch64 ] && [ -w /dev/kvm ] && accel=kvm && cpu=host
  qemu-system-aarch64 -machine virt,accel=$accel -cpu $cpu -m 2048 -smp 2 -nographic -bios "$firmware" \
    -drive file="$work/disk.img",format=raw,if=virtio \
    -netdev user,id=n0,hostfwd=tcp::14096-:4096 -device virtio-net-pci,netdev=n0 >"$log" 2>&1 &
fi
pid=$!
trap 'kill $pid 2>/dev/null || true; rm -rf "$work"' EXIT
start=$(date +%s)
until curl -fsS -o /dev/null http://127.0.0.1:14096/; do
  if [ $(( $(date +%s) - start )) -ge "$timeout_s" ]; then
    echo "Appliance did not serve the app within ${timeout_s}s. Serial console tail:" >&2
    tail -n 80 "$log" >&2
    exit 1
  fi
  sleep 5
done
code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:14096/api/config)
echo "Appliance boot test passed in $(( $(date +%s) - start ))s: web app answered on port 4096, API answered $code (401 expected without the password)."
