#!/usr/bin/env node
/**
 * Expo dev-server launcher that picks the right network interface.
 *
 * Expo CLI guesses which local IP to advertise in the QR code. On a machine
 * with VMware / VirtualBox / Hyper-V / Docker installed there are several
 * candidates, and it frequently picks a virtual adapter (typically something
 * at 192.168.x.x). Phones cannot route to those, so scanning the QR just
 * hangs with no error — the usual "it works in the emulator but not on my
 * phone" symptom.
 *
 * Setting REACT_NATIVE_PACKAGER_HOSTNAME pins the advertised address, so here
 * we work out the real LAN interface ourselves and pass it through.
 *
 * Usage:
 *   node scripts/start-dev.js            → LAN (same Wi-Fi, fastest)
 *   node scripts/start-dev.js --tunnel   → tunnel (any network, via ngrok)
 *   node scripts/start-dev.js --host 10.0.0.5   → force a specific address
 */

const os = require('os');
const { spawn } = require('child_process');

/** Adapters that exist on the host but are unreachable from a phone. */
const VIRTUAL = /vmware|virtualbox|vbox|hyper-?v|vethernet|docker|wsl|loopback|tailscale|zerotier|tun|tap|bluetooth/i;

/** Adapters that are usually the real way out to the network. */
const PHYSICAL = /wi-?fi|wlan|wireless|ethernet|eth\d|en\d|local area connection/i;

function candidates() {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      // 169.254.x.x means the adapter never got a DHCP lease.
      if (a.address.startsWith('169.254.')) continue;
      out.push({ name, address: a.address, virtual: VIRTUAL.test(name), physical: PHYSICAL.test(name) });
    }
  }
  return out;
}

function pickHost() {
  const all = candidates();
  if (!all.length) return null;

  // Real adapters first, virtual ones last; within each group prefer the
  // recognisably physical names.
  const ranked = [...all].sort((a, b) => {
    if (a.virtual !== b.virtual) return a.virtual ? 1 : -1;
    if (a.physical !== b.physical) return a.physical ? -1 : 1;
    return 0;
  });

  return { chosen: ranked[0], all };
}

const argv = process.argv.slice(2);
const tunnel = argv.includes('--tunnel');
const hostFlagIdx = argv.indexOf('--host');
const forcedHost = hostFlagIdx !== -1 ? argv[hostFlagIdx + 1] : null;

const picked = pickHost();
const host = forcedHost || picked?.chosen?.address || null;

console.log('');
console.log('  Sehri Connect — dev server');
console.log('  ─────────────────────────────────────────────');

if (picked) {
  for (const c of picked.all) {
    const isChosen = c.address === host;
    const tag = c.virtual ? 'virtual — phones cannot reach this' : 'physical';
    console.log(`  ${isChosen ? '▶' : ' '} ${c.address.padEnd(16)} ${c.name}  (${tag})`);
  }
}

if (tunnel) {
  console.log('');
  console.log('  Mode: TUNNEL — works from any network, including mobile data.');
  console.log('  Slower to load, but the only option on Wi-Fi that blocks');
  console.log('  device-to-device traffic (common on campus networks).');
} else if (host) {
  console.log('');
  console.log(`  Mode: LAN — advertising ${host}`);
  console.log('  Every device must be on this same Wi-Fi.');
  console.log('  If a phone cannot connect, use: npm run start:tunnel');
}

console.log('');
console.log('  Once Metro is up:');
console.log('    • Phone   → open Expo Go and scan the QR code');
console.log('    • Android → press  a   (emulator)');
console.log('    • iOS     → press  i   (simulator, macOS only)');
console.log('  Any number of devices can connect at the same time.');
console.log('  ─────────────────────────────────────────────');
console.log('');

const env = { ...process.env };
if (host && !tunnel) {
  env.REACT_NATIVE_PACKAGER_HOSTNAME = host;
}

const args = ['start', tunnel ? '--tunnel' : '--lan',
  ...argv.filter((a) => a !== '--tunnel' && a !== '--host' && a !== forcedHost)];

// Run the Expo CLI's JS entry point under this same Node binary.
//
// Spawning `npx` instead would mean `npx.cmd` on Windows, which Node 24
// refuses to launch without `shell: true` (EINVAL), and `shell: true` in turn
// triggers an escaping deprecation warning. Going straight to the CLI avoids
// both, and skips the npx resolution step.
const cli = require.resolve('@expo/cli/build/bin/cli');

const child = spawn(process.execPath, [cli, ...args], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code) => process.exit(code ?? 0));
