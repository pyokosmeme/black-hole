import { cborEncodeLabel } from './labeler.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';

function decodeBase58(string) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const bytes = [0];
  for (const char of string) {
    const value = alphabet.indexOf(char);
    if (value < 0) throw new Error('bad base58 char: ' + char);
    let carry = value;
    for (let i = 0; i < bytes.length; i++) { carry += bytes[i] * 58; bytes[i] = carry & 255; carry >>= 8; }
    while (carry) { bytes.push(carry & 255); carry >>= 8; }
  }
  let zeros = 0;
  for (const char of string) { if (char === '1') zeros++; else break; }
  return Uint8Array.from([...new Array(zeros).fill(0), ...bytes.reverse()]);
}

const labels = (await (await fetch('https://lastnpcalex.agency/xrpc/com.atproto.label.queryLabels?uriPatterns=*')).json()).labels;
const doc = await (await fetch('https://lastnpcalex.agency/.well-known/did.json')).json();
const key = decodeBase58(doc.verificationMethod[0].publicKeyMultibase.slice(1));
console.log('key length:', key.length, 'prefix: 0x' + key[0].toString(16));

for (const l of labels) {
  const { sig, ...rest } = l;
  const sigBytes = Uint8Array.from(Buffer.from(sig.$bytes, 'base64'));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', cborEncodeLabel(rest)));
  const ok = secp256k1.verify(sigBytes, digest, key); // (signature, msgHash, publicKey)
  console.log(`${ok ? 'OK' : 'FAIL'} ${l.val} → ${l.uri}`);
}
