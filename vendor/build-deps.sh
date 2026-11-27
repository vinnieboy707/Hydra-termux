#!/bin/sh
# Rebuilds vendor/deps.tgz, the runtime libraries install.sh unpacks so installing needs no network and no npm.
# Contents: exactly the packages package-lock.json marks as runtime (ethers 6.17.0 and what it loads), installed by
# `npm ci` (which checks every package against the sha512 recorded in the lockfile), then trimmed to the CommonJS
# build this console loads. Licence files are kept. The archive is byte-for-byte reproducible.
#   sh vendor/build-deps.sh        (from the chronos-console folder; needs npm and network once)
set -e
DIR=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cp "$DIR/package.json" "$DIR/package-lock.json" "$TMP/"
cd "$TMP"
npm ci --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error
N=node_modules
# type definitions only, never loaded at run time
rm -rf "$N/@types" "$N/undici-types" "$N/.package-lock.json"
# ES-module and browser builds and TypeScript sources: this console loads only the CommonJS build
rm -rf "$N/ethers/lib.esm" "$N/ethers/dist" "$N/ethers/src.ts" "$N/ethers/rollup.config.mjs" \
       "$N/aes-js/lib.esm" "$N/aes-js/src.ts" "$N/aes-js/misc" "$N"/aes-js/*.tgz \
       "$N/@noble/curves/esm" "$N/@noble/curves/src" "$N/@noble/hashes/esm" "$N/@noble/hashes/src"
find "$N" -type f \( -name '*.map' -o -name '*.ts' -o -name 'README*' -o -name 'CHANGELOG*' -o -name 'SECURITY.md' \) -exec rm -f {} +
# smoke test: load everything ethers loads and exercise each dependency once
node -e "
const { ethers } = require('ethers');
const i = new ethers.Interface(['function quote(uint256 a) view returns (uint256)']);
if (i.encodeFunctionData('quote', [7]).slice(0, 10) !== i.getFunction('quote').selector) throw new Error('abi');
if (ethers.keccak256('0x') !== '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470') throw new Error('keccak');
if (ethers.getAddress('0x000000000000000000000000000000000000dead') !== '0x000000000000000000000000000000000000dEaD') throw new Error('checksum');
if (ethers.ensNormalize('Chronos.eth') !== 'chronos.eth') throw new Error('ens');
ethers.SigningKey.computePublicKey('0x' + '01'.padStart(64, '0'));
new ethers.JsonRpcProvider('http://127.0.0.1:9', 42161, { staticNetwork: true }).destroy();
if (typeof require('ws') !== 'function' || typeof ethers.WebSocketProvider !== 'function') throw new Error('ws');
console.log('smoke test passed: ethers ' + ethers.version);
"
mkdir -p "$DIR/vendor"
tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner --mode='a+rX,u+w,go-w' -cf - -C "$N" . | gzip -n -9 > "$DIR/vendor/deps.tgz.tmp"
mv "$DIR/vendor/deps.tgz.tmp" "$DIR/vendor/deps.tgz"
echo "vendor/deps.tgz: $(wc -c < "$DIR/vendor/deps.tgz") bytes, $(find "$N" -type f | wc -l) files, sha256 $(sha256sum "$DIR/vendor/deps.tgz" | cut -c1-16)…"
