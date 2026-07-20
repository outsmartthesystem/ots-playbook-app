'use strict';
// Copy the playbook markdown VERBATIM from ots-content/sop into content/playbook/
// (plan 4.1). Copies are byte-identical and never hand-edited. Run locally, commit
// the copies; the deployed app reads the committed copies (it cannot see ots-content).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SRC = process.env.OTS_CONTENT_DIR || path.resolve(__dirname, '..', 'ots-content', 'sop');
const DEST = path.join(__dirname, 'content', 'playbook');

function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12); }

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`[sync] source not found: ${SRC}\nSet OTS_CONTENT_DIR to your ots-content/sop path.`);
    process.exit(1);
  }
  fs.mkdirSync(DEST, { recursive: true });
  const files = fs.readdirSync(SRC).filter((f) => /^\d\d-.*\.md$/.test(f) || f === '00-START-HERE.md').sort();
  let changed = 0;
  for (const f of files) {
    const srcBuf = fs.readFileSync(path.join(SRC, f));
    const destPath = path.join(DEST, f);
    const prev = fs.existsSync(destPath) ? fs.readFileSync(destPath) : null;
    if (!prev || !prev.equals(srcBuf)) {
      fs.writeFileSync(destPath, srcBuf);
      console.log(`[sync] ${prev ? 'updated' : 'added  '} ${f}  (${sha(srcBuf)})`);
      changed += 1;
    } else {
      console.log(`[sync] same    ${f}  (${sha(srcBuf)})`);
    }
  }
  // report copies that no longer exist in source (a human decides what to do)
  const destFiles = fs.existsSync(DEST) ? fs.readdirSync(DEST).filter((f) => f.endsWith('.md')) : [];
  for (const f of destFiles) {
    if (!files.includes(f)) console.warn(`[sync] WARNING: ${f} exists in copies but not in source. Delete by hand if intended.`);
  }
  console.log(`[sync] ${files.length} files, ${changed} changed. Now run: npm run ingest -- --dry`);
}

main();
