'use strict';
/* P1 SPA: the Business Binder. Loaded after the inline script in index.html, so it
   shares api()/esc()/app/statusPill()/renderTabs()/md() from the global scope. */

function prettyKind(k){ return String(k).replace(/_/g,' '); }
function setDeep(obj, path, val){ const ks=path.split('.'); let o=obj; for(let i=0;i<ks.length-1;i++){ o[ks[i]]=o[ks[i]]||{}; o=o[ks[i]]; } o[ks[ks.length-1]]=val; }

// ---------- binder list ----------
async function screenBinder(){
  const { binder } = await api('/api/me/binder');
  app.innerHTML = `<h1>Your binder</h1>
    <p class="muted">Twelve living documents. This is your business. If you leave, you leave with everything.</p>
    ${binder.map(b=>`<div class="station" onclick="location.hash='#/artifact/${b.kind}'">
      <div><strong>Ch ${b.chapter}: ${esc(prettyKind(b.kind))}</strong>
        ${b.open_flag_count?`<div class="muted">${b.open_flag_count} flag to resolve</div>`:''}</div>
      ${statusPill(b.status||'not_started')}</div>`).join('')}`;
  renderTabs('binder');
}

// ---------- artifact editor ----------
async function screenArtifact(kind){
  const d = await api('/api/artifacts/'+kind);
  window._art = { kind, data: d.artifact.data || {}, config: d.config, status: d.artifact.status };
  let quotes = [];
  if(kind==='brandscript'){ try{ quotes=(await api('/api/me/quotes')).quotes; }catch(_){}
    window._art.quotes = quotes; }
  render_art();
}
function render_art(){
  const { kind, data, config, status } = window._art;
  let body;
  if(kind==='voc_sheet') body=vocEditor(data);
  else if(kind==='brandscript') body=brandscriptEditor(data, window._art.quotes||[]);
  else if(kind==='offer_truth_file') body=offerEditor(data);
  else body=guidedEditor(config, data);
  const returnNote = window._art.review_note;
  app.innerHTML = `<a class="muted" href="#/binder">&lsaquo; Binder</a>
    <h1>${esc(prettyKind(kind))} ${statusPill(status)}</h1>
    <div class="row"><a class="muted grow" href="#/elena">See Elena's example</a>
      <a class="muted" href="#/artifact/${kind}/versions">History</a></div>
    ${window._art.presence&&window._art.presence.length?`<div class="card" style="border-color:var(--accent2)"><strong>Before you can submit:</strong><ul>${window._art.presence.map(m=>'<li>'+esc(m)+'</li>').join('')}</ul></div>`:''}
    <div id="ed">${body}</div>
    ${(status==='submitted'||status==='verified')
      ? `<div class="card"><strong>${status==='verified'?'Verified by Coach Jay.':'Submitted. Waiting on Jay.'}</strong>
           <div class="muted">This is read-only now. Ask Jay to send it back if you need to change it.</div></div>`
      : `<div class="card">
          <div id="art_err" class="err"></div>
          <div class="row">
            <button class="grow" onclick="saveArtifact()">Save</button>
            <button class="ghost" onclick="submitArtifact()">Submit to Jay</button>
          </div>
        </div>`}`;
  renderTabs('binder');
}

const VOC_BUCKETS=['fears','frustrations','dream','exact_words','objections','price'];
const VOC_CONSENTS=['research_only','ok_to_quote_anon','ok_to_quote_named'];
function vocEditor(data){
  data.quotes = data.quotes || []; data.interviews = data.interviews || [];
  return `<div class="card">
    <label>Who is your customer? (in a sentence)</label>
    <textarea rows="2" oninput="window._art.data.who_my_customer_is=this.value">${esc(data.who_my_customer_is||'')}</textarea>
  </div>
  <div class="card"><strong>Interviews</strong>
    <p class="muted">Who you talked to. Did you ask before recording? Was a trusted adult in the loop?</p>
    <div id="voc_ivs">${vocIvsHtml(data.interviews)}</div>
    <button class="ghost" onclick="vocAddIv()">+ Add an interview</button>
  </div>
  <div class="card"><strong>Their exact words</strong>
    <p class="muted">D13: at least one quote in each bucket. Real sentences only. A blank bucket is honest. A made-up quote is not.</p>
    <div id="voc_quotes">${vocQuotesHtml(data.quotes)}</div>
    <button class="ghost" onclick="vocAddQuote()">+ Add a quote</button>
  </div>`;
}
function vocIvsHtml(ivs){
  return ivs.map((v,i)=>`<div class="row" style="margin:6px 0;flex-wrap:wrap">
    <input placeholder="who (use an alias)" value="${esc(v.alias||'')}" oninput="window._art.data.interviews[${i}].alias=this.value">
    <label style="font-size:12px;font-weight:400"><input type="checkbox" style="width:auto" ${v.recorded_consent?'checked':''} onchange="window._art.data.interviews[${i}].recorded_consent=this.checked"> recording consent</label>
    <label style="font-size:12px;font-weight:400"><input type="checkbox" style="width:auto" ${v.adult_in_loop?'checked':''} onchange="window._art.data.interviews[${i}].adult_in_loop=this.checked"> adult in loop</label>
    <button class="ghost" onclick="vocRemoveIv(${i})">&times;</button></div>`).join('') || '<p class="muted">No interviews logged yet.</p>';
}
function vocAddIv(){ window._art.data.interviews.push({alias:'',recorded_consent:false,adult_in_loop:false});
  document.getElementById('voc_ivs').innerHTML=vocIvsHtml(window._art.data.interviews); }
function vocRemoveIv(i){ window._art.data.interviews.splice(i,1);
  document.getElementById('voc_ivs').innerHTML=vocIvsHtml(window._art.data.interviews); }
function vocQuotesHtml(quotes){
  return quotes.map((q,i)=>`<div class="row" style="margin:6px 0;flex-wrap:wrap">
    <select onchange="window._art.data.quotes[${i}].bucket=this.value">
      ${VOC_BUCKETS.map(b=>`<option value="${b}" ${q.bucket===b?'selected':''}>${b}</option>`).join('')}</select>
    <input class="grow" placeholder="their exact words" value="${esc(q.verbatim_text||'')}" oninput="window._art.data.quotes[${i}].verbatim_text=this.value">
    <select onchange="window._art.data.quotes[${i}].consent_flag=this.value">
      ${VOC_CONSENTS.map(c=>`<option value="${c}" ${(q.consent_flag||'research_only')===c?'selected':''}>${c.replace(/_/g,' ')}</option>`).join('')}</select>
    <button class="ghost" onclick="vocRemoveQuote(${i})">&times;</button></div>`).join('') || '<p class="muted">No quotes yet.</p>';
}
function vocAddQuote(){ window._art.data.quotes.push({bucket:'fears',verbatim_text:'',consent_flag:'research_only'});
  document.getElementById('voc_quotes').innerHTML=vocQuotesHtml(window._art.data.quotes); }
function vocRemoveQuote(i){ window._art.data.quotes.splice(i,1);
  document.getElementById('voc_quotes').innerHTML=vocQuotesHtml(window._art.data.quotes); }

function brandscriptEditor(data, quotes){
  const problem=(key,label)=>{ const p=data[key]||(data[key]={text:'',source_quote_ref:'',no_source:false});
    return `<div class="card"><label>${label}</label>
      <textarea rows="2" oninput="window._art.data.${key}.text=this.value">${esc(p.text||'')}</textarea>
      <label>Point it at one of your real VoC quotes</label>
      <select onchange="window._art.data.${key}.source_quote_ref=this.value">
        <option value="">(pick a quote)</option>
        ${quotes.map(q=>`<option value="${q.ref}" ${p.source_quote_ref===q.ref?'selected':''}>${esc((q.bucket||'')+': '+(q.text||'').slice(0,40))}</option>`).join('')}
      </select>
      <label><input type="checkbox" style="width:auto" ${p.no_source?'checked':''} onchange="window._art.data.${key}.no_source=this.checked"> No source yet, verify before publishing</label>
    </div>`; };
  return problem('external_problem','External problem (what is visibly going wrong)')
    + problem('internal_problem','Internal problem (how it makes them feel)')
    + problem('philosophical_problem','Philosophical problem (why it is just wrong)')
    + `<div class="card"><label>Your one-liner</label>
        <textarea rows="2" oninput="window._art.data.one_liner=this.value">${esc(data.one_liner||'')}</textarea></div>`;
}

function offerEditor(data){
  data.paid_offer=data.paid_offer||{}; data.claims_allowed=data.claims_allowed||[];
  const o=data.paid_offer;
  const f=(k,label,ph)=>`<label>${label}</label><input value="${esc(o[k]||'')}" placeholder="${ph||''}" oninput="window._art.data.paid_offer.${k}=this.value">`;
  return `<div class="card">
    ${f('name','Offer name')}${f('who_for','Who it is for')}
    <label>What they get</label><textarea rows="2" oninput="window._art.data.paid_offer.deliverables=this.value">${esc(o.deliverables||'')}</textarea>
    <label>Price (dollars)</label><input type="number" value="${o.price_cents?o.price_cents/100:''}" oninput="window._art.data.paid_offer.price_cents=Math.round(this.value*100)">
    <label>Refund promise (exact words)</label><textarea rows="2" oninput="window._art.data.paid_offer.refund_promise_exact_words=this.value">${esc(o.refund_promise_exact_words||'')}</textarea>
  </div>
  <div class="card"><strong>Claims I am allowed to make</strong>
    <p class="muted">Every claim needs a proof source, or the row cannot save.</p>
    <div id="claims">${claimsHtml(data.claims_allowed)}</div>
    <button class="ghost" onclick="offerAddClaim()">+ Add a claim</button></div>`;
}
function claimsHtml(claims){ return claims.map((c,i)=>`<div class="row" style="margin:6px 0">
  <input class="grow" placeholder="claim" value="${esc(c.claim||'')}" oninput="window._art.data.claims_allowed[${i}].claim=this.value">
  <input class="grow" placeholder="proof source" value="${esc(c.proof_source||'')}" oninput="window._art.data.claims_allowed[${i}].proof_source=this.value">
  <button class="ghost" onclick="offerRemoveClaim(${i})">&times;</button></div>`).join('')||'<p class="muted">No claims yet.</p>'; }
function offerAddClaim(){ window._art.data.claims_allowed.push({claim:'',proof_source:''}); document.getElementById('claims').innerHTML=claimsHtml(window._art.data.claims_allowed); }
function offerRemoveClaim(i){ window._art.data.claims_allowed.splice(i,1); document.getElementById('claims').innerHTML=claimsHtml(window._art.data.claims_allowed); }

function guidedEditor(config, data){
  data.sections=data.sections||{};
  return (config.guided_sections||[]).map(s=>`<div class="card">
    <label>${esc(s.label)} ${s.req?'<span class="muted">(required)</span>':''}</label>
    <textarea rows="3" oninput="window._art.data.sections['${s.key}']=this.value">${esc(data.sections[s.key]||'')}</textarea>
  </div>`).join('');
}

function setErr(t, ok){ const el=document.getElementById('art_err'); if(el) el.innerHTML = ok?'<span style="color:var(--ok)">'+esc(t)+'</span>':esc(String(t).replace(/[{}\[\]"]/g,' ').slice(0,300)); }
// returns true only on a clean save
async function saveArtifact(pivotReason){
  const { kind, data } = window._art;
  const body = { data }; if(pivotReason) body.pivot_reason=pivotReason;
  try{
    const r = await api('/api/artifacts/'+kind,{method:'PUT',body:JSON.stringify(body)});
    window._art.presence = r.presence_missing;
    setErr('Saved. Version '+r.version+'.', true);
    return true;
  }catch(e){
    if(/pivot_required/.test(e.message)){
      const reason = prompt('You changed something load-bearing. Why? (this goes in your history, like Jay does)');
      if(reason) return await saveArtifact(reason);
      setErr('Not saved. A change to a locked field needs a reason.');
      return false;
    }
    setErr(e.message);
    return false;
  }
}
async function submitArtifact(){
  const { kind } = window._art;
  const ok = await saveArtifact(); // persist current edits first; abort if it failed
  if(!ok) return;
  // honesty mirror (plan 4.3): a real confirm before it becomes ON RECORD
  const mirror = kind==='voc_sheet'
    ? 'Everything in this sheet is something a real person actually said. Nothing is invented.'
    : 'Everything here is true and something I can stand behind. Nothing is invented.';
  if(!confirm(mirror+'\n\nIs that true?')) return;
  try{
    const r = await api('/api/artifacts/'+kind+'/submit',{method:'POST',body:JSON.stringify({})});
    celebrate(r.on_record);
  }catch(e){
    setErr(e.message);
    try{ const d=await api('/api/artifacts/'+kind); window._art.presence=d.presence_missing; window._art.status=d.artifact.status; render_art(); }catch(_){}
  }
}
function celebrate(line){
  app.innerHTML = `<div class="card hero" style="margin-top:40px">
    <div class="pill" style="background:#fff">ON RECORD</div>
    <h1 style="color:#fff;margin:.4em 0">${esc(line||'A real business document.')}</h1>
    <div class="muted">You started building. Jay's build took months. Slow and real beats fast and fake.</div>
    <a class="btn ghost" style="background:#fff;margin-top:12px" href="#/binder">Back to your binder</a></div>`;
}

async function screenArtifactVersions(kind){
  const v = await api('/api/artifacts/'+kind+'/versions');
  app.innerHTML = `<a class="muted" href="#/artifact/${kind}">&lsaquo; Back</a><h1>${esc(prettyKind(kind))} history</h1>
    ${v.review_note?`<div class="card" style="border-color:var(--accent2)"><strong>Jay's return note:</strong> ${esc(v.review_note)}</div>`:''}
    ${v.versions.map(x=>`<div class="card"><div class="row"><strong class="grow">v${x.version} &middot; ${esc(x.status_at_save)}</strong><span class="muted">${new Date(x.created_at).toLocaleString()}</span></div>
      ${x.change_note?`<div class="muted">${esc(x.change_note)}</div>`:''}</div>`).join('')}
    ${v.pivots.length?`<h2>Pivots</h2>${v.pivots.map(p=>`<div class="card"><strong>${esc(p.field)}</strong><div class="muted">${esc(p.old_value)} &rarr; ${esc(p.new_value)}</div><div>${esc(p.reason)}</div></div>`).join('')}`:''}`;
  renderTabs('binder');
}

// ---------- Elena ----------
async function screenElena(){
  const e = await api('/api/elena/binder');
  app.innerHTML = `<a class="muted" href="#/binder">&lsaquo; Binder</a>
    <h1>Elena's example</h1>
    <div class="card" style="border-color:var(--accent2)">${esc(e.label)}</div>
    ${(e.artifacts||[]).map(a=>`<div class="card"><strong>${esc(prettyKind(a.kind))}</strong>
      <pre style="user-select:none">${esc(typeof a.data==='string'?a.data:JSON.stringify(a.data,null,2))}</pre></div>`).join('')
      || '<p class="muted">Elena&#39;s example binder is being finalized.</p>'}
    <p class="muted">These are Elena&#39;s answers. Do not copy them. Your real ones will be better because they are true.</p>`;
  renderTabs('binder');
}

// ---------- onboarding (three promises) ----------
function screenOnboarding(){
  app.innerHTML = `<h1>Three promises</h1>
    <p class="muted">Before you build anything, you make three promises. They are the whole playbook in miniature.</p>
    <div class="card"><strong>1. Never fabricate.</strong><div class="muted">No made-up numbers, names, quotes, reviews, or results.</div></div>
    <div class="card"><strong>2. Verify before publishing.</strong><div class="muted">If you cannot prove it, you hold it back until you can.</div></div>
    <div class="card"><strong>3. A trusted adult is in the loop.</strong><div class="muted">For anything with money, accounts, or agreements.</div></div>
    <div id="ob_err" class="err"></div>
    <button class="wide" onclick="acceptPromises()">I promise. Start.</button>`;
  renderTabs();
}
async function acceptPromises(){
  try{ const r=await api('/api/onboarding/promises',{method:'POST',body:JSON.stringify({})});
    if(ME) ME.has_onboarded=true; celebrate(r.on_record);
  }catch(e){ document.getElementById('ob_err').textContent=e.message; }
}

// ---------- admin review loop ----------
async function screenReviewQueue(){
  const { queue, snippets } = await api('/api/admin/review-queue');
  window._snips = snippets;
  app.innerHTML = `<a class="muted" href="#/admin">&lsaquo; Cohort</a><h1>Review queue (${queue.length})</h1>
    <p class="muted">Oldest first. Drive this to zero.</p>
    ${queue.length? queue.map(a=>`<div class="station" onclick="location.hash='#/review/${a.id}'">
      <div><strong>${esc(a.first_name)} ${esc(a.last_initial||'')} &middot; ${esc(prettyKind(a.kind))}</strong>
        <div class="muted">Ch ${a.chapter_number||''} &middot; submitted ${new Date(a.submitted_at).toLocaleString()}${a.open_flag_count?` &middot; ${a.open_flag_count} flag`:''}</div></div>
      <span class="pill">review</span></div>`).join('') : '<p class="muted">Nothing waiting. Nice.</p>'}`;
  renderTabs();
}
async function screenReviewArtifact(id){
  const d = await api('/api/admin/artifacts/'+id);
  const a = d.artifact;
  app.innerHTML = `<a class="muted" href="#/review">&lsaquo; Queue</a>
    <h1>${esc(a.first_name)}: ${esc(prettyKind(a.kind))} ${statusPill(a.status)}</h1>
    ${d.acceptance_proof?`<div class="card" style="border-color:var(--accent)"><strong>Check for:</strong> ${esc(d.acceptance_proof)}</div>`:''}
    ${a.open_flag_count?`<div class="card" style="border-color:var(--accent2)">${a.open_flag_count} open "verify before publishing" flag(s).</div>`:''}
    <div class="card"><pre>${esc(JSON.stringify(a.data,null,2))}</pre></div>
    ${d.pivots.length?`<h2>Pivots</h2>${d.pivots.map(p=>`<div class="card"><strong>${esc(p.field)}</strong>: ${esc(p.old_value)} &rarr; ${esc(p.new_value)}<div class="muted">${esc(p.reason)}</div></div>`).join('')}`:''}
    <div class="card">
      <label>Return note (min 20 chars). Snippets:</label>
      <div>${(window._snips||[]).map(s=>`<button class="ghost" style="font-size:12px;padding:6px" onclick="document.getElementById('rn').value='${esc(s.body).replace(/'/g,"\\'")}'">${esc(s.title)}</button>`).join(' ')}</div>
      <textarea id="rn" rows="3"></textarea>
      <div id="rev_err" class="err"></div>
      <div class="row">
        <button class="grow" onclick="verifyArtifact(${id})">Verify</button>
        <button class="ghost" onclick="returnArtifact(${id})">Return with note</button>
      </div>
    </div>`;
  renderTabs();
}
async function verifyArtifact(id){ try{ await api('/api/admin/artifacts/'+id+'/verify',{method:'POST',body:'{}'}); location.hash='#/review'; }
  catch(e){ document.getElementById('rev_err').textContent=e.message; } }
async function returnArtifact(id){ const note=document.getElementById('rn').value.trim();
  try{ await api('/api/admin/artifacts/'+id+'/return',{method:'POST',body:JSON.stringify({note})}); location.hash='#/review'; }
  catch(e){ document.getElementById('rev_err').textContent=e.message; } }
