'use strict';
// Parse the verbatim playbook copies (content/playbook/*.md) into content rows,
// using ONLY the verified conventions in plan 4.1 (no cleverness beyond them).
// Pure parse functions (no DB) are exported for the golden + idempotence tests.
// The DB writer runs on `node ingest.js`; `--dry` parses and reports without writing.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONTENT_DIR = path.join(__dirname, 'content', 'playbook');
const MANIFEST_PATH = path.join(__dirname, 'content', 'sop-manifest.json');

function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
// strip leading/trailing markdown emphasis and heading marks from a heading/label line
function stripEmphasis(line) {
  return line.replace(/^#{1,6}\s*/, '').replace(/^[*_>\s]+|[*_\s]+$/g, '').trim();
}

// Split a file into { title, intro, sections: [{ heading, lines }] } by H2.
function splitSections(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let title = '';
  const intro = [];
  const sections = [];
  let cur = null;
  let seenH1 = false;
  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);
    if (h1 && !seenH1) { title = h1[1].trim(); seenH1 = true; continue; }
    if (h2) { cur = { heading: h2[1].trim(), lines: [] }; sections.push(cur); continue; }
    if (cur) cur.lines.push(line);
    else if (seenH1) intro.push(line);
  }
  return { title, intro, sections };
}

// From a block of lines starting at idx, collect the next block element.
// Returns { body, body_form, nextIdx } or null.
function takeBlock(lines, idx) {
  while (idx < lines.length && lines[idx].trim() === '') idx += 1;
  if (idx >= lines.length) return null;
  const first = lines[idx];
  if (/^```/.test(first)) {
    const buf = [first]; idx += 1;
    while (idx < lines.length && !/^```/.test(lines[idx])) { buf.push(lines[idx]); idx += 1; }
    if (idx < lines.length) { buf.push(lines[idx]); idx += 1; }
    return { body: buf.join('\n'), body_form: 'code', nextIdx: idx };
  }
  if (/^\s*\|/.test(first)) {
    const buf = []; while (idx < lines.length && /^\s*\|/.test(lines[idx])) { buf.push(lines[idx]); idx += 1; }
    return { body: buf.join('\n'), body_form: 'table', nextIdx: idx };
  }
  if (/^\s*>/.test(first)) {
    const buf = []; while (idx < lines.length && (/^\s*>/.test(lines[idx]) || lines[idx].trim() === '' && /^\s*>/.test(lines[idx + 1] || ''))) { buf.push(lines[idx]); idx += 1; }
    return { body: buf.join('\n'), body_form: 'blockquote', nextIdx: idx };
  }
  if (/^\s*[-*]\s+/.test(first)) {
    const buf = []; while (idx < lines.length && (/^\s*[-*]\s+/.test(lines[idx]) || /^\s{2,}\S/.test(lines[idx]))) { buf.push(lines[idx]); idx += 1; }
    return { body: buf.join('\n'), body_form: 'list', nextIdx: idx };
  }
  return null;
}

// Extract COPY AND ADAPT templates from a block of lines. Returns [{title, body, body_form, is_worksheet}].
function extractTemplates(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const bare = stripEmphasis(lines[i]);
    if (/copy.?and.?adapt/i.test(bare)) {
      const title = bare.replace(/.*copy.?and.?adapt[:\s]*/i, '').trim() || 'template';
      const blk = takeBlock(lines, i + 1);
      if (blk) {
        const blanks = (blk.body.match(/_{3,}|\[.*?\]/g) || []).length;
        out.push({ title, body: blk.body, body_form: blk.body_form, is_worksheet: blk.body_form === 'code' && blanks >= 3 });
      }
    }
  }
  return out;
}

// Split a step's lines into teach / jay / now_you by bold labels.
function splitStepBody(lines) {
  const joined = lines.join('\n');
  const labelRe = /(^|\n)\s*\*\*(What to do|How Jay did it|How it works|Now you)\.?:?\*\*/gi;
  const marks = [];
  let m;
  while ((m = labelRe.exec(joined)) !== null) {
    marks.push({ label: m[2].toLowerCase(), start: m.index + (m[1] ? m[1].length : 0) });
  }
  const out = { teach_md: '', jay_md: '', now_you_md: '' };
  if (marks.length === 0) { out.teach_md = joined.trim(); return out; }
  for (let i = 0; i < marks.length; i += 1) {
    const seg = joined.slice(marks[i].start, i + 1 < marks.length ? marks[i + 1].start : undefined).trim();
    const lbl = marks[i].label;
    if (lbl === 'what to do') out.teach_md += (out.teach_md ? '\n\n' : '') + seg;
    else if (lbl === 'now you') out.now_you_md += (out.now_you_md ? '\n\n' : '') + seg;
    else out.jay_md += (out.jay_md ? '\n\n' : '') + seg; // how jay did it / how it works
  }
  return out;
}

// Parse the 00 START-HERE map table -> { "01": {title, walk_away, rough_time}, ... }
function parseMap(startHereText) {
  const map = {};
  const lines = startHereText.replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    const m = line.match(/^\|\s*(\d\d)-[a-z0-9-]+\.md\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/);
    if (m) map[m[1]] = { title: m[2], walk_away: m[3], rough_time: m[4] };
  }
  return map;
}

// Parse one chapter file.
function parseChapter(numStr, filename, text, manifestCh, mapEntry) {
  const number = parseInt(numStr, 10);
  const { title, intro, sections } = splitSections(text);
  const chapterKey = numStr;
  const steps = [];
  const templates = [];
  const checklist = [];
  const glossary = [];
  const body_sections = [];
  if (intro.join('\n').trim()) body_sections.push({ heading: 'intro', md: intro.join('\n').trim() });

  const overrides = (manifestCh && manifestCh.step_kind_overrides) || {};
  const defaultKind = (manifestCh && manifestCh.default_step_kind) || 'read';
  const artifactKind = manifestCh ? manifestCh.artifact_kind : null;

  let maxPos = 0;
  for (const sec of sections) {
    const stepM = sec.heading.match(/^Step\s+(\d+)[.:]\s*(.+)$/i);
    if (stepM) {
      const pos = parseInt(stepM[1], 10);
      maxPos = Math.max(maxPos, pos);
      const kind = overrides[String(pos)] || defaultKind;
      const parts = splitStepBody(sec.lines);
      steps.push({
        stable_key: `${chapterKey}/step/${pos}`,
        position: pos,
        title: stepM[2].trim(),
        kind,
        teach_md: parts.teach_md,
        jay_md: parts.jay_md,
        now_you_md: parts.now_you_md,
        artifact_section: kind === 'artifact' ? artifactKind : null,
        evidence_fields: (manifestCh && manifestCh.action_evidence && manifestCh.action_evidence[String(pos)]) || null,
      });
      for (const t of extractTemplates(sec.lines)) {
        templates.push({ stable_key: `${chapterKey}/template/${slug(t.title)}`, step_position: pos, ...t });
      }
    } else if (/check\s+your\s+work/i.test(sec.heading)) {
      let idx = 0;
      for (const line of sec.lines) {
        const c = line.match(/^\s*-\s*\[\s?\]\s*(.+)$/);
        if (c) { idx += 1; checklist.push({ stable_key: `${chapterKey}/check/${idx}`, position: idx, text: c[1].trim() }); }
      }
    } else if (/words\s+you\s+just\s+learned/i.test(sec.heading) || /master\s+glossary/i.test(sec.heading)) {
      for (const line of sec.lines) {
        const g = line.match(/^\s*-\s*\*\*(.+?)\*\*[:\s]+(.+)$/);
        if (g) glossary.push({ term: g[1].trim(), definition: g[2].trim() });
      }
    } else {
      // reading section (includes "What you need", "See it work first", etc.)
      body_sections.push({ heading: sec.heading, md: sec.lines.join('\n').trim() });
      for (const t of extractTemplates(sec.lines)) {
        templates.push({ stable_key: `${chapterKey}/template/${slug(t.title)}`, step_position: null, ...t });
      }
    }
  }

  // Synthesize one checklist step per chapter that has a checklist (plan 4.1).
  if (checklist.length > 0) {
    const pos = maxPos + 1;
    steps.push({
      stable_key: `${chapterKey}/checkwork`,
      position: pos,
      title: 'Check your work',
      kind: 'checklist',
      teach_md: '', jay_md: '', now_you_md: '',
      artifact_section: null, evidence_fields: null,
    });
  }

  return {
    stable_key: chapterKey,
    number,
    title,
    walk_away: mapEntry ? mapEntry.walk_away : null,
    rough_time: mapEntry ? mapEntry.rough_time : null,
    body_sections,
    steps: steps.sort((a, b) => a.position - b.position),
    templates,
    checklist,
    glossary,
    source_hash: sha(text).slice(0, 16),
  };
}

// Parse every file in a directory. Pure, no DB. Deterministic ordering.
function parseAll(dir = CONTENT_DIR, manifest = null) {
  const mani = manifest || JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const files = fs.readdirSync(dir).filter((f) => /^\d\d-.*\.md$/.test(f)).sort();
  const startHere = files.find((f) => f.startsWith('00-'));
  const map = startHere ? parseMap(fs.readFileSync(path.join(dir, startHere), 'utf8')) : {};
  const chapters = files.map((f) => {
    const numStr = f.slice(0, 2);
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    return parseChapter(numStr, f, text, mani.chapters[numStr] || null, map[numStr] || null);
  });
  return { chapters, map };
}

function counts(parsed) {
  const c = { chapters: parsed.chapters.length, steps: 0, templates: 0, checklist_items: 0, glossary_terms: 0 };
  for (const ch of parsed.chapters) {
    c.steps += ch.steps.length;
    c.templates += ch.templates.length;
    c.checklist_items += ch.checklist.length;
    c.glossary_terms += ch.glossary.length;
  }
  return c;
}

// ---- DB writer (runs only on `node ingest.js`, needs DATABASE_URL) ----
async function writeToDb(parsed, gitHash, force) {
  require('dotenv').config();
  const { query, tx } = require('./lib/db');
  const c = counts(parsed);
  // count-drop guard (plan 4.1): fail loudly if any category shrinks
  const { rows: prev } = await query(`SELECT counts FROM content_versions ORDER BY id DESC LIMIT 1`);
  if (prev[0] && !force) {
    for (const k of Object.keys(c)) {
      if (typeof prev[0].counts[k] === 'number' && c[k] < prev[0].counts[k]) {
        throw new Error(`[ingest] count DROPPED for ${k}: ${prev[0].counts[k]} -> ${c[k]}. Refusing. Use --force only after writing an old-key migration.`);
      }
    }
  }
  await tx(async (client) => {
    for (const ch of parsed.chapters) {
      const { rows } = await client.query(
        `INSERT INTO chapters (stable_key, number, title, walk_away, rough_time, body_sections, source_hash, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)
         ON CONFLICT (stable_key) DO UPDATE SET number=$2, title=$3, walk_away=$4, rough_time=$5,
           body_sections=$6, source_hash=$7, is_active=TRUE
         RETURNING id`,
        [ch.stable_key, ch.number, ch.title, ch.walk_away, ch.rough_time, JSON.stringify(ch.body_sections), ch.source_hash]
      );
      const chapterId = rows[0].id;
      for (const s of ch.steps) {
        await client.query(
          `INSERT INTO steps (stable_key, chapter_id, position, title, kind, teach_md, jay_md, now_you_md,
             evidence_fields, artifact_section, acceptance_proof, source_hash, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE)
           ON CONFLICT (stable_key) DO UPDATE SET chapter_id=$2, position=$3, title=$4, kind=$5,
             teach_md=$6, jay_md=$7, now_you_md=$8, evidence_fields=$9, artifact_section=$10,
             content_updated_at = CASE WHEN steps.source_hash IS DISTINCT FROM $12 THEN now() ELSE steps.content_updated_at END,
             source_hash=$12, is_active=TRUE`,
          [s.stable_key, chapterId, s.position, s.title, s.kind, s.teach_md, s.jay_md, s.now_you_md,
           s.evidence_fields ? JSON.stringify(s.evidence_fields) : null, s.artifact_section, null, ch.source_hash]
        );
      }
      for (const t of ch.templates) {
        await client.query(
          `INSERT INTO templates (stable_key, chapter_id, title, body, body_form, is_worksheet)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (stable_key) DO UPDATE SET chapter_id=$2, title=$3, body=$4, body_form=$5, is_worksheet=$6`,
          [t.stable_key, chapterId, t.title, t.body, t.body_form, t.is_worksheet]
        );
      }
      for (const ci of ch.checklist) {
        await client.query(
          `INSERT INTO checklist_items (stable_key, chapter_id, position, text)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (stable_key) DO UPDATE SET chapter_id=$2, position=$3, text=$4`,
          [ci.stable_key, chapterId, ci.position, ci.text]
        );
      }
      // glossary has no stable key: replace per chapter
      await client.query(`DELETE FROM glossary_terms WHERE chapter_id = $1`, [chapterId]);
      for (const g of ch.glossary) {
        await client.query(
          `INSERT INTO glossary_terms (chapter_id, term, definition) VALUES ($1,$2,$3)`,
          [ch.number === 0 ? null : chapterId, g.term, g.definition]
        );
      }
    }
    await client.query(
      `INSERT INTO content_versions (git_hash, counts) VALUES ($1, $2)`,
      [gitHash || null, JSON.stringify(c)]
    );
  });
  return c;
}

async function main() {
  const dry = process.argv.includes('--dry');
  const force = process.argv.includes('--force');
  const parsed = parseAll();
  const c = counts(parsed);
  console.log('[ingest] parsed:', JSON.stringify(c));
  if (dry) { console.log('[ingest] --dry: nothing written.'); process.exit(0); }
  try {
    const written = await writeToDb(parsed, process.env.OTS_CONTENT_GIT_HASH, force);
    console.log('[ingest] wrote to DB:', JSON.stringify(written));
    process.exit(0);
  } catch (err) {
    console.error(err.message); process.exit(1);
  }
}

module.exports = { parseAll, parseChapter, parseMap, splitSections, splitStepBody, extractTemplates, counts };

if (require.main === module) main();
