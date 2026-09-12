import { createPublicKey, ECDH, verify } from 'node:crypto';
import { cborEncodeLabel, LABELER_DID } from './labeler.js';

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

async function readJson(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${new URL(url).hostname}${new URL(url).pathname}: HTTP ${response.status}`);
  return response.json();
}

async function main() {
  // This is a did:plc labeler. Resolve its specific label key, not the repo
  // key or the site's unrelated legacy did:web document.
  const doc = await readJson(`https://plc.directory/${LABELER_DID}`);
  const method = doc.verificationMethod?.find(item => item.id === `${LABELER_DID}#atproto_label` || item.id === '#atproto_label');
  const service = doc.service?.find(item => item.id === `${LABELER_DID}#atproto_labeler` || item.id === '#atproto_labeler');
  if (!method?.publicKeyMultibase?.startsWith('z') || !service?.serviceEndpoint) throw new Error('Missing labeler public key or endpoint');
  const encoded = decodeBase58(method.publicKeyMultibase.slice(1));
  if (encoded.length !== 35 || encoded[0] !== 0xe7 || encoded[1] !== 0x01) throw new Error('Expected a secp256k1 multicodec public key');
  const point = ECDH.convertKey(encoded.subarray(2), 'secp256k1', undefined, undefined, 'uncompressed');
  const publicKey = createPublicKey({ format: 'jwk', key: {
    kty: 'EC', crv: 'secp256k1',
    x: point.subarray(1, 33).toString('base64url'), y: point.subarray(33).toString('base64url'),
  } });
  let cursor;
  let checked = 0;
  const cursors = new Set();
  do {
    const url = new URL('/xrpc/com.atproto.label.queryLabels', service.serviceEndpoint);
    url.searchParams.set('uriPatterns', '*');
    url.searchParams.set('limit', '250');
    if (cursor) url.searchParams.set('cursor', cursor);
    const page = await readJson(url);
    if (!Array.isArray(page.labels)) throw new Error('Invalid label query response');
    for (const label of page.labels) {
      const { sig, ver, src, uri, val, cts, cid, neg, exp } = label;
      const signature = Buffer.from(sig?.$bytes || '', 'base64');
      // OpenSSL hashes the original CBOR once, independently of Noble.
      const ok = src === LABELER_DID && signature.length === 64 && verify('sha256',
        cborEncodeLabel({ ver, src, uri, val, cts, cid, neg, exp }),
        { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature);
      console.log(`${ok ? 'OK' : 'FAIL'} ${val} → ${uri}`);
      if (!ok) process.exitCode = 1;
      checked++;
    }
    cursor = page.cursor;
    if (cursor && cursors.has(cursor)) throw new Error('Label endpoint repeated a pagination cursor');
    cursors.add(cursor);
  } while (cursor);
  console.log(`Checked ${checked} signatures against the published PLC label key.`);

  // Optional: node verify-labels.mjs <profile handle or DID>
  const actor = process.argv[2];
  if (actor) {
    const url = new URL('https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile');
    url.searchParams.set('actor', actor);
    const profile = await readJson(url, { headers: { 'atproto-accept-labelers': LABELER_DID } });
    const visible = (profile.labels || []).filter(label => label.src === LABELER_DID);
    console.log(`Bluesky AppView labels for ${profile.handle}: ${visible.map(label => label.val).join(', ') || '(none)'}`);
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
