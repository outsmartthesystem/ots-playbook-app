'use strict';
/* P2 SPA: parent app, scoreboard, checkpoints, link-pending, privacy.
   Shares globals from the inline script (api, esc, app, statusPill, ME, setToken, logout). */

function val(id){ const el=document.getElementById(id); return el?el.value:''; }
function cell(v,unk){ return unk?'<span class="muted">unknown</span>':(v!=null?v:'-'); }
function addDaysISO(iso, days){ const d=new Date(iso+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10); }
// Renders every Monday from the first logged week to `upto` (or the last logged week).
// A week with no row shows as an explicit "skipped" gap, not silently absent (proof d).
function sparkTable(weeks, upto){
  if(!weeks.length) return '<p class="muted">No weeks logged yet.</p>';
  const byWeek={}; weeks.forEach(w=>{ byWeek[w.week_start]=w; });
  const sorted=weeks.map(w=>w.week_start).sort();
  const start=sorted[0]; const end=upto||sorted[sorted.length-1];
  const rows=[]; let cur=start, guard=0;
  while(cur<=end && guard<80){ rows.push(byWeek[cur]||{week_start:cur,gap:true}); cur=addDaysISO(cur,7); guard++; }
  return `<div style="overflow-x:auto"><table><thead><tr><th>Week</th><th>Clicks</th><th>Leads</th><th>Paid</th><th>Revenue</th></tr></thead><tbody>
    ${rows.map(w=>w.gap
      ? `<tr class="muted"><td>${esc(w.week_start)}</td><td colspan="4">skipped</td></tr>`
      : `<tr><td>${esc(w.week_start)}</td><td>${cell(w.clicks,w.clicks_unknown)}</td><td>${cell(w.leads,w.leads_unknown)}</td><td>${cell(w.paid,w.paid_unknown)}</td><td>${w.revenue_unknown?'<span class="muted">unknown</span>':(w.revenue_cents!=null?'$'+(w.revenue_cents/100):'-')}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function renderParentTabs(active){
  const t=document.getElementById('tabs');
  const tab=(h,l,k)=>`<a class="${active===k?'active':''}" href="${h}">${l}</a>`;
  t.innerHTML=`<div class="tabs">${tab('#/','Home','home')}${tab('#/approvals','Sign-offs','approvals')}<a href="#" onclick="logout();return false">Log out</a></div>`;
}

/* ---------- parent ---------- */
async function screenParentHome(){
  const { children } = await api('/api/parent/children');
  app.innerHTML=`<h1>Your teens</h1>
    ${children.length?children.map(c=>`<div class="station" onclick="location.hash='#/child/${c.id}'">
      <div><strong>${esc(c.first_name)} ${esc(c.last_initial||'')}</strong><div class="muted">${esc(c.account_state)}</div></div><span class="pill">&rsaquo;</span></div>`).join('')
      :'<p class="muted">No teen linked yet. Add yours below.</p>'}
    <button class="ghost" onclick="location.hash='#/add-teen'">+ Add your teen</button>
    <p class="foot"><a href="#/what-parent-sees">What you can see</a> &middot; <a href="#/privacy">Privacy</a></p>`;
  renderParentTabs('home');
}
async function screenParentChild(id){
  const d=await api('/api/parent/children/'+id);
  app.innerHTML=`<a class="muted" href="#/">&lsaquo; Your teens</a>
    <h1>${esc(d.student.first_name)}</h1>
    <div class="muted">${d.documents_submitted} of 12 documents submitted. Last activity: ${d.last_activity?new Date(d.last_activity).toLocaleDateString():'none yet'}.</div>
    ${d.pending_approvals.length?`<div class="card" style="border-color:var(--accent2)"><strong>Action needed</strong>
      ${d.pending_approvals.map(a=>`<div style="margin:8px 0">${esc(a.text)} <a href="#/approvals">Review</a></div>`).join('')}</div>`:''}
    <h2>Documents</h2>
    ${d.artifacts.length?d.artifacts.map(a=>`<div class="station" onclick="location.hash='#/child/${id}/doc/${a.kind}'">
      <div><strong>${esc(a.kind.replace(/_/g,' '))}</strong></div>${statusPill(a.status)}</div>`).join(''):'<p class="muted">Nothing submitted yet.</p>'}
    <h2>Scoreboard <span class="muted" style="font-size:12px">self-reported by your teen</span></h2>
    ${d.scoreboard.length?sparkTable(d.scoreboard):'<p class="muted">The scoreboard starts in Chapter 10. Nothing to show yet, and that is normal.</p>'}
    <p class="foot"><a href="#/what-parent-sees">What you can see</a></p>`;
  renderParentTabs();
}
async function screenParentDoc(id,kind){
  const d=await api('/api/parent/artifact/'+id+'/'+kind);
  app.innerHTML=`<a class="muted" href="#/child/${id}">&lsaquo; Back</a><h1>${esc(kind.replace(/_/g,' '))}</h1>
    ${d.artifact.review_note?`<div class="card" style="border-color:var(--accent2)"><strong>Jay&#39;s note:</strong> ${esc(d.artifact.review_note)}</div>`:''}
    <div class="card"><pre>${esc(JSON.stringify(d.artifact.data,null,2))}</pre></div>
    <p class="muted">You are reading your teen&#39;s work. You cannot edit it here, and that is by design.</p>`;
  renderParentTabs();
}
async function screenParentApprovals(){
  const { approvals } = await api('/api/parent/approvals');
  app.innerHTML=`<h1>Sign-offs</h1>
    ${approvals.length?approvals.map(a=>`<div class="card"><strong>${esc(a.first_name)}</strong><p>${esc(a.text)}</p>
      ${a.subject_ref?`<div class="muted">About: ${esc(a.subject_ref)}</div>`:''}
      ${a.release_reference?`<div class="muted">Release reference: ${esc(a.release_reference)}</div>`:''}
      <textarea id="note_${a.id}" rows="2" placeholder="note (required to say not yet)"></textarea>
      <div class="row"><button class="grow" onclick="decideApproval(${a.id},'approve')">Approve</button>
        <button class="ghost" onclick="decideApproval(${a.id},'decline')">Not yet</button></div>
      <div id="err_${a.id}" class="err"></div></div>`).join(''):'<p class="muted">Nothing waiting. Nice.</p>'}`;
  renderParentTabs('approvals');
}
async function decideApproval(id,action){
  const note=val('note_'+id);
  try{ await api('/api/parent/approvals/'+id+'/'+action,{method:'POST',body:JSON.stringify({note})}); screenParentApprovals(); }
  catch(e){ const el=document.getElementById('err_'+id); if(el) el.textContent=e.message; }
}
function screenAddTeen(){
  app.innerHTML=`<a class="muted" href="#/">&lsaquo; Back</a><h1>Add your teen</h1>
    <div class="card">
      <p class="muted">This program is for teens 13 to 17 with a linked parent. Students 18 and older can hold their own account. Under 13 is not supported.</p>
      <label>First name</label><input id="t_first">
      <label>Last initial (optional)</label><input id="t_last" maxlength="1">
      <label>Age</label><input id="t_age" type="number" min="13" max="19">
      <label>Username (optional, if they have no email)</label><input id="t_user">
      <div id="t_err" class="err"></div>
      <button onclick="doAddTeen()">Create and get the claim link</button>
      <div id="t_out"></div>
    </div>`;
  renderParentTabs();
}
async function doAddTeen(){
  const b={ first_name:val('t_first'), last_initial:val('t_last'), age:val('t_age'), username:val('t_user') };
  try{ const d=await api('/api/parent/add-teen',{method:'POST',body:JSON.stringify(b)});
    document.getElementById('t_out').innerHTML=`<p class="muted">Hand this link to your teen so they can set their password:</p><pre>${esc(d.claim_url)}</pre>`;
  }catch(e){ document.getElementById('t_err').textContent=e.message; }
}

/* ---------- parent account setup (pre-auth link) ---------- */
function screenParentSetup(token){
  const consents=[
    ["is_guardian","I am the parent or legal guardian of this teen."],
    ["consent_use","I consent to my teen using this program."],
    ["understand_visibility","I understand I can see my teen&#39;s progress, artifacts, and coursework questions."],
    ["understand_safety_review","I understand safety-flagged messages may be reviewed by a designated OTS responder and may not appear in my view."]
  ];
  app.innerHTML=`<h1>Set up your parent account</h1>
    <div class="card">
      <label>Create a password (8+ characters)</label><input id="ps_pw" type="password">
      <div style="margin:12px 0">${consents.map(c=>`<label style="font-weight:400;display:block;margin:8px 0"><input type="checkbox" style="width:auto" data-consent="${c[0]}"> ${c[1]}</label>`).join('')}</div>
      <div id="ps_err" class="err"></div>
      <button class="wide" onclick="doParentSetup('${esc(token)}')">Create account</button>
    </div>`;
  document.getElementById('tabs').innerHTML='';
}
async function doParentSetup(token){
  const pw=val('ps_pw'); const consents={};
  document.querySelectorAll('[data-consent]').forEach(el=>{ consents[el.getAttribute('data-consent')]=el.checked; });
  try{ const d=await api('/api/parent/setup',{method:'POST',body:JSON.stringify({token,password:pw,consents})});
    setToken(d.token); ME=d.user; location.hash='#/';
  }catch(e){ document.getElementById('ps_err').textContent=e.message; }
}

/* ---------- student: scoreboard ---------- */
function numRow(k,label){ return `<label>${label}</label><div class="row"><input class="grow" id="sc_${k}" type="number">
  <label style="font-weight:400;font-size:13px"><input type="checkbox" style="width:auto" id="sc_${k}_u"> unknown</label></div>`; }
async function screenScore(){
  const d=await api('/api/me/scoreboard');
  app.innerHTML=`<h1>Scoreboard</h1>
    ${d.today_is_review_day?`<div class="card hero"><strong style="color:#fff">It is your review day.</strong><div class="muted">20 minutes. Numbers first, feelings second.</div></div>`:''}
    <div class="card">
      <label>Week starting (Monday)</label><input id="sc_week" type="date" value="${d.this_monday}">
      ${numRow('clicks','Clicks')}${numRow('leads','Leads')}${numRow('paid','Paid')}${numRow('revenue','Revenue (dollars)')}
      <label>Leak of the week</label><input id="sc_leak">
      <label>Learning</label><input id="sc_learn">
      <label>Dial-in for next week (one sentence)</label><input id="sc_dial" maxlength="240">
      <p class="muted">A true zero beats a comfortable guess. Not sure of a number? Check "unknown".</p>
      <div id="sc_err" class="err"></div>
      <button class="wide" onclick="saveScore()">Save this week</button>
    </div>
    <h2>Past weeks</h2>
    ${sparkTable(d.weeks, d.this_monday)}`;
  renderTabs('score');
}
async function saveScore(){
  const g=id=>document.getElementById(id);
  const b={ week_start:val('sc_week'),
    clicks:val('sc_clicks'), clicks_unknown:g('sc_clicks_u').checked,
    leads:val('sc_leads'), leads_unknown:g('sc_leads_u').checked,
    paid:val('sc_paid'), paid_unknown:g('sc_paid_u').checked,
    revenue:val('sc_revenue'), revenue_unknown:g('sc_revenue_u').checked,
    leak:val('sc_leak'), learning:val('sc_learn'), dial_in:val('sc_dial') };
  try{ await api('/api/me/scoreboard',{method:'POST',body:JSON.stringify(b)}); screenScore(); }
  catch(e){ document.getElementById('sc_err').textContent=e.message; }
}

/* ---------- student: checkpoints ---------- */
async function screenCheckpoints(){
  const { registry, approvals } = await api('/api/me/checkpoints');
  const byKey={}; approvals.forEach(a=>{ if(!byKey[a.checkpoint_key]) byKey[a.checkpoint_key]=a; });
  app.innerHTML=`<h1>Parent sign-offs</h1>
    <p class="muted">Some steps need a parent to sign off. Ask here. Your parent sees the request and the thing they are signing off on.</p>
    ${registry.map(c=>{ const a=byKey[c.key]; const st=a?a.status:'none';
      return `<div class="card"><strong>Ch ${c.chapter}</strong> ${statusPill(st==='none'?'not_started':st)}<p>${esc(c.text)}</p>
        ${st==='approved'?'<div class="muted">Approved.</div>':st==='requested'?'<div class="muted">Waiting on your parent.</div>':
          `${c.per_subject?`<input id="subj_${c.key}" placeholder="who is this about?">`:''}
           ${c.key==='CP-STORY-CONSENT'?`<input id="rel_${c.key}" placeholder="reference to the signed release form">`:''}
           <button class="ghost" onclick="requestCp('${c.key}',${c.per_subject?'true':'false'})">Ask my parent</button>`}
        ${a&&a.note?`<div class="muted">Parent note: ${esc(a.note)}</div>`:''}</div>`;
    }).join('')}`;
  renderTabs();
}
async function requestCp(key, perSubject){
  const body={};
  if(perSubject) body.subject_ref=val('subj_'+key);
  if(key==='CP-STORY-CONSENT') body.release_reference=val('rel_'+key);
  try{ await api('/api/checkpoints/'+key+'/request',{method:'POST',body:JSON.stringify(body)}); screenCheckpoints(); }
  catch(e){ alert(e.message); }
}

/* ---------- shared static ---------- */
function screenLinkPending(){
  app.innerHTML=`<h1>Almost there</h1>
    <div class="card"><p>Your account is waiting to be linked to your parent. Ask your parent to add you from their account, then log in again.</p></div>
    <p class="foot"><a href="#" onclick="logout();return false">Log out</a></p>`;
  document.getElementById('tabs').innerHTML='';
}
async function screenPrivacy(){
  const d=await api('/api/privacy');
  app.innerHTML=`<a class="muted" href="#" onclick="history.back();return false">&lsaquo; Back</a><h1>Privacy</h1>${d.paragraphs.map(p=>'<p>'+esc(p)+'</p>').join('')}`;
}
async function screenWhatParentSees(){
  const d=await api('/api/parent-visibility');
  app.innerHTML=`<a class="muted" href="#" onclick="history.back();return false">&lsaquo; Back</a><h1>What your parent can see</h1>
    <div class="card"><strong>They see</strong><ul>${d.sees.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul></div>
    <div class="card"><strong>They do not see</strong><ul>${d.not_sees.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul></div>`;
}
