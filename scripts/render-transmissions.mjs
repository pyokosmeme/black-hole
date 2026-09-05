import { renderDocument } from '../transmission-document.js';

// Batch protocol keeps the Python publishing command and uses the same renderer
// as live admin-backed share URLs. No content is fetched or modified.
let input = '';
for await (const chunk of process.stdin) input += chunk;
process.stdout.write(JSON.stringify(JSON.parse(input).map(({ source, baseUrl }) => renderDocument(source, baseUrl))));
