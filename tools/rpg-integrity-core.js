'use strict';
const escapeHtml=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function collectFailures(report){
 const f=[];
 if(!report||report.schema!=='life-file-rpg-integrity-v1')f.push('schema');
 for(const [i,r] of ((report&&report.dynamic&&report.dynamic.scenarios)||[]).entries()){
  const id='scenario:'+i+':';
  if(!r.complete||r.steps>32||r.steps<1)f.push(id+'softlock');
  if(r.cost!==1||!r.energyRejectedBeforeStart)f.push(id+'energy');
  if(r.meritDelta!==20||r.duplicatePayouts!==0)f.push(id+'merit');
  if(r.archiveCount!==1)f.push(id+'archive');
  if(r.contractAfter!==r.contractBefore||r.salaryAfter!==r.salaryBefore||r.cashDelta!==0)f.push(id+'economy');
  if(!Array.isArray(r.invariants)||r.invariants.length)f.push(id+'invariants');
  if(r.stage===1&&!r.followupVisibleNextYear)f.push(id+'late_callback');
  if(r.followupVisibleSameYear||r.choiceAvailable===false)f.push(id+'agency');
 }
 for(const v of report&&report.odds||[])
  if(v.outcomes!==216||v.samples<1200||
    Math.abs(v.exactPercent-v.samplePercent)>v.maxToleratedDeviation)f.push('odds:'+v.difficulty);
 if(report&&report.authored){
  const a=report.authored;
  if(a.questCount!==12||a.safeOpenings!==12||a.brokenEdges.length||a.cycles.length||a.buildFailures.length)
    f.push('authored');
 }
 if(report&&report.playthrough){
  const p=report.playthrough;
  if(p.sessions!==180||p.terminalRuns!==180||p.failures.length)f.push('playthrough');
 }
 return f;
}
function renderHtml(r){
 const esc=escapeHtml,d=r.dynamic,findings=collectFailures(r);
 const badge=ok=>'<span class="badge '+(ok?'ok':'bad')+'">'+(ok?'PASS':'FAIL')+'</span>';
 const rows=d.scenarios.map((s,i)=>{
  const good=s.complete&&s.duplicatePayouts===0&&s.archiveCount===1&&s.meritDelta===20&&s.cashDelta===0;
  return '<tr><td>'+(i+1)+'</td><td>'+esc(s.policy)+'</td><td>'+esc(s.family)+'</td><td>'+
   (s.stage===1?'Follow-up':'Opening')+'</td><td>'+esc(s.endingId)+'</td><td>'+s.rolls+
   '</td><td>'+s.steps+'</td><td>'+s.meritDelta+'</td><td>'+s.cost+'</td><td>'+badge(good)+'</td></tr>';
 }).join('');
 const a=r.authored||{},p=r.playthrough||{},outcomes=Object.entries(d.outcomes||{}).sort((x,y)=>y[1]-x[1]||x[0].localeCompare(y[0]));
 const prog=(label,v,total)=>'<div class="progress"><span>'+esc(label)+'</span><strong>'+v+'/'+total+
  '</strong><div class="track"><i style="width:'+Math.min(100,Math.max(0,Math.round(100*v/Math.max(1,total))))+'%"></i></div></div>';
 const css=`:root{color-scheme:dark;--edge:#435668;--ink:#eff5e9;--muted:#b8cdd0;--accent:#b8d4af}
 *{box-sizing:border-box}html{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#131e29;color:var(--ink)}
 body{margin:0;min-width:0;background:linear-gradient(145deg,#151e26,#283640)}
 main{width:min(1160px,100%);margin:auto;padding:24px clamp(10px,3vw,35px) 70px}
 header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:14px;align-items:start;margin-bottom:18px}
 h1{font-size:clamp(26px,4vw,38px);line-height:1.1;margin:5px 0}h2{font-size:19px;margin:0 0 14px}
 p{line-height:1.55;color:var(--muted)}.eyebrow{font-size:11px;letter-spacing:.15em;font-weight:800;color:var(--accent)}
 .notice{max-width:430px;border:1px solid var(--edge);border-radius:12px;padding:12px;
   font-size:12px;line-height:1.6;color:var(--muted);overflow-wrap:anywhere}
 .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
 .card,.panel{background:#202e3b;border:1px solid var(--edge);border-radius:15px;min-width:0}
 .card{padding:16px}.card b{display:block;font-size:clamp(22px,3vw,32px);color:#d4eebf;font-variant-numeric:tabular-nums}
 .card small{display:block;color:var(--muted);font-size:12px}.panel{padding:18px;margin-top:16px}
 .pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
 table{width:100%;border-collapse:collapse;text-align:left;font-size:12px}
 th,td{padding:9px 8px;border-bottom:1px solid var(--edge);overflow-wrap:anywhere}
 th{color:var(--accent);text-transform:uppercase;font-size:10px;white-space:nowrap}
 .scroll{max-width:100%;overflow-x:auto}.scroll:focus-visible{outline:3px solid #f3c88c;outline-offset:2px}.scroll table{min-width:660px}
 .badge{display:inline-block;padding:4px 8px;border-radius:20px;font-size:10px;font-weight:800}
 .badge.ok{background:#335942;color:#cdeacb}.badge.bad{background:#673e3a;color:#fcd0be}
 .progress{display:grid;grid-template-columns:1fr auto;gap:6px;margin:12px 0;font-size:12px}
 .progress strong{font-variant-numeric:tabular-nums}
 .track{grid-column:1/-1;background:#485862;border-radius:8px;height:8px;overflow:hidden}
 .track i{display:block;height:100%;background:linear-gradient(90deg,#86b6b2,#d3dfa4)}
 .note{font-size:11px;color:var(--muted);overflow-wrap:anywhere;margin-top:14px}
 @media(max-width:600px){main{padding:15px 10px 45px}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}
  .pair{grid-template-columns:1fr}.card,.panel{padding:12px}}
 @media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}}`;
 const odds=r.odds.map(o=>'<tr><td>'+esc(o.difficulty)+'</td><td>'+o.tn+'</td><td>'+o.exactPercent+
  '%</td><td>'+o.samplePercent+'%</td><td>'+o.samples+'</td><td>±'+o.maxToleratedDeviation+
  ' pp</td><td>'+badge(Math.abs(o.exactPercent-o.samplePercent)<=o.maxToleratedDeviation)+'</td></tr>').join('');
 return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<title>Life File RPG Integrity Report</title><style>'+css+'</style></head><body><main>'+
  '<header><div><div class="eyebrow">LIFE FILE · ENGINEERING DIAGNOSTICS</div><h1>RPG INTEGRITY</h1>'+
  '<p>Quantitative reproducible scenario assessment</p></div>'+
  '<div class="notice"><b>Automated simulation, not human testing.</b><div>'+esc(r.provenance)+
  '</div>Seeded prerequisite archives are fixtures, not naturally observed play histories.</div></header>'+
  '<div class="cards"><div class="card"><b>'+d.completed+' / '+d.sessions+'</b><small>Completed scenarios</small></div>'+
  '<div class="card"><b>'+d.softlocks+'</b><small>Choice softlocks</small></div>'+
  '<div class="card"><b>'+d.energyCost+'</b><small>Annual energy charged</small></div>'+
  '<div class="card"><b>'+d.meritEarned+'</b><small>Merit awarded</small></div></div>'+
  '<div class="pair"><section class="panel"><h2>Integrity gates</h2>'+
  prog('Dynamic completions',d.completed,d.sessions)+prog('Authored safe openings',a.safeOpenings||0,a.questCount||12)+
  prog('Authored playthroughs',p.terminalRuns||0,p.sessions||180)+
  '<p class="note">'+findings.length+' findings '+badge(!findings.length)+'</p></section>'+
  '<section class="panel"><h2>Economic consistency</h2><p>Each actual StorySystem scenario compares the canonical'+
  ' contract ID, salary, cash, energy, merit and archive. No participant finances were collected.</p>'+
  '<p>'+d.economicViolations+' economic violations · '+d.meritViolations+
  ' merit violations · '+d.energyViolations+' energy violations</p></section></div>'+
  '<section class="panel"><h2>Exact odds vs sampled 3d6</h2><div class="scroll" tabindex="0" role="region" aria-label="Scrollable diagnostics table"><table>'+
  '<thead><tr><th>Difficulty</th><th>Target</th><th>Exact odds</th><th>Sampled odds</th>'+
  '<th>Trials</th><th>Tolerance</th><th>Gate</th></tr></thead><tbody>'+odds+'</tbody></table></div>'+
  '<p class="note">Exact odds count successful 3d6 triples among 216 equiprobable outcomes. '+
  'Sampled odds are deterministic empirical trials; equality is not assumed.</p></section>'+
  '<section class="panel"><h2>Recorded synthetic outcomes</h2><div class="scroll" tabindex="0" role="region" aria-label="Scrollable diagnostics table"><table>'+
  '<thead><tr><th>Ending</th><th>Sessions</th></tr></thead><tbody>'+
  outcomes.map(([id,n])=>'<tr><td>'+esc(id)+'</td><td>'+n+'</td></tr>').join('')+
  '</tbody></table></div></section>'+
  '<section class="panel"><h2>Machine scenario evidence</h2><p>'+d.sessions+
  ' multi-year policy runs with explicitly seeded prerequisite fixtures.</p>'+
  '<div class="scroll" tabindex="0" role="region" aria-label="Scrollable diagnostics table"><table><thead><tr><th>#</th><th>Policy</th><th>Family</th><th>Stage</th>'+
  '<th>Ending</th><th>Rolls</th><th>Steps</th><th>Merit</th><th>Energy</th><th>Gate</th></tr></thead>'+
  '<tbody>'+rows+'</tbody></table></div></section>'+
  '<p class="note">Schema: '+esc(r.schema)+'. Regenerate with npm run report:rpg. '+
  'This static report does not modify game saves, submit analytics or indicate a public deployment.</p>'+
  '</main></body></html>';
}
module.exports={escapeHtml,collectFailures,renderHtml};
