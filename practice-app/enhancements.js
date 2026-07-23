/* Desktop coaching enhancements: analytics, drag-to-plan, drill stats, whiteboard */
(() => {
  const q = id => document.getElementById(id);
  const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getArchives = () => Array.isArray(state?.archives) ? state.archives : [];
  const blockMinutes = b => Math.max(0, Number(b?.minutes) || 0);
  const allCats = () => (typeof CATEGORIES !== 'undefined' ? CATEGORIES : []);
  const totalsFor = archives => {
    const out = Object.fromEntries(allCats().map(c => [c.id, 0]));
    archives.forEach(a => (a.blocks || []).forEach(b => {
      const id = categoryInfo(b.category).id;
      out[id] = (out[id] || 0) + blockMinutes(b);
    }));
    return out;
  };
  const archiveDate = a => new Date((a.date || a.plannedDate || a.archivedAt || '') + ((a.date || a.plannedDate) ? 'T12:00:00' : ''));
  const monthKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const pct = (n,d) => d ? Math.round(n/d*100) : 0;

  function installAnalyticsUI(){
    const page=q('practiceDataPage'); if(!page || q('advancedAnalytics')) return;
    const node=document.createElement('section'); node.id='advancedAnalytics'; node.className='advanced-analytics';
    node.innerHTML=`<div class="analytics-title-row"><div><h2>Practice Analytics Dashboard</h2><p>Season, monthly, and recent-practice trends based on planned practice time.</p></div><select id="analyticsWindow"><option value="season">Full season</option><option value="month">This month</option><option value="last10">Last 10 practices</option></select></div><div class="analytics-metrics" id="analyticsMetrics"></div><div class="analytics-grid"><div class="analytics-card"><h3>Category Mix</h3><div id="analyticsCategoryMix"></div></div><div class="analytics-card"><h3>This Month vs Last Month</h3><div id="analyticsMonthCompare"></div></div><div class="analytics-card"><h3>Recent Practice Lengths</h3><div id="analyticsRecent"></div></div><div class="analytics-card"><h3>Coaching Alerts</h3><div id="analyticsAlerts"></div></div></div>`;
    page.insertBefore(node,page.firstChild);
    q('analyticsWindow').addEventListener('change',renderAdvancedAnalytics);
  }
  function bars(totals){
    const total=Object.values(totals).reduce((a,b)=>a+b,0);
    return allCats().filter(c=>(totals[c.id]||0)>0).sort((a,b)=>(totals[b.id]||0)-(totals[a.id]||0)).map(c=>`<div class="analytics-bar-row"><div><span>${safe(c.label)}</span><strong>${totals[c.id]||0} min · ${pct(totals[c.id]||0,total)}%</strong></div><div class="analytics-track"><i style="width:${pct(totals[c.id]||0,total)}%"></i></div></div>`).join('') || '<p class="muted">No archived practice data yet.</p>';
  }
  function renderAdvancedAnalytics(){
    if(!q('advancedAnalytics')) return;
    const archives=getArchives().filter(a=>!Number.isNaN(archiveDate(a).getTime())).sort((a,b)=>archiveDate(b)-archiveDate(a));
    const now=new Date(), thisKey=monthKey(now), prev=new Date(now.getFullYear(),now.getMonth()-1,1), prevKey=monthKey(prev);
    const thisMonth=archives.filter(a=>monthKey(archiveDate(a))===thisKey), lastMonth=archives.filter(a=>monthKey(archiveDate(a))===prevKey);
    const mode=q('analyticsWindow')?.value||'season';
    const selected=mode==='month'?thisMonth:mode==='last10'?archives.slice(0,10):archives;
    const minutes=selected.reduce((s,a)=>s+(a.blocks||[]).reduce((x,b)=>x+blockMinutes(b),0),0);
    const avg=selected.length?Math.round(minutes/selected.length):0;
    const totals=totalsFor(selected);
    q('analyticsMetrics').innerHTML=[['Practices',selected.length],['Total Hours',(minutes/60).toFixed(minutes%60?1:0)],['Avg Length',`${avg} min`],['Last 30 Days',archives.filter(a=>(now-archiveDate(a))/86400000<=30).length]].map(([k,v])=>`<div class="analytics-metric"><span>${k}</span><strong>${v}</strong></div>`).join('');
    q('analyticsCategoryMix').innerHTML=bars(totals);
    const tm=totalsFor(thisMonth), lm=totalsFor(lastMonth);
    q('analyticsMonthCompare').innerHTML=allCats().filter(c=>(tm[c.id]||0)||(lm[c.id]||0)).map(c=>{const change=(tm[c.id]||0)-(lm[c.id]||0);return `<div class="compare-row"><span>${safe(c.label)}</span><strong class="${change>0?'up':change<0?'down':''}">${change>0?'+':''}${change} min</strong></div>`}).join('')||'<p class="muted">Archive practices across two months to compare.</p>';
    q('analyticsRecent').innerHTML=archives.slice(0,10).map(a=>{const m=(a.blocks||[]).reduce((s,b)=>s+blockMinutes(b),0);return `<div class="recent-row"><span>${archiveDate(a).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span><div class="recent-track"><i style="width:${Math.min(100,m/120*100)}%"></i></div><strong>${m}m</strong></div>`}).join('')||'<p class="muted">No recent practices.</p>';
    const alerts=[]; const seasonTotals=totalsFor(archives), seasonMin=Object.values(seasonTotals).reduce((a,b)=>a+b,0);
    allCats().forEach(c=>{const p=pct(seasonTotals[c.id]||0,seasonMin); if(['technique_top','technique_bottom','technique_neutral','live'].includes(c.id)&&p<8)alerts.push(`${c.label} is only ${p}% of season time.`)});
    if(avg>110) alerts.push(`Average planned practice is ${avg} minutes.`);
    q('analyticsAlerts').innerHTML=(alerts.length?alerts:['Category balance looks healthy based on current data.']).map(x=>`<div class="analytics-alert">${safe(x)}</div>`).join('');
  }

  function drillStats(d){
    const uses=[]; getArchives().forEach(a=>(a.blocks||[]).forEach(b=>{if((b.name||'').trim().toLowerCase()===(d.name||'').trim().toLowerCase())uses.push({minutes:blockMinutes(b),date:archiveDate(a)})}));
    return {uses:uses.length,avg:uses.length?Math.round(uses.reduce((s,x)=>s+x.minutes,0)/uses.length):Number(d.minutes)||0,last:uses.length?new Date(Math.max(...uses.map(x=>x.date.getTime()))):null};
  }
  function enhanceDrillCards(){
    document.querySelectorAll('#drillLibraryList .drill-card').forEach(card=>{
      const add=card.querySelector('.drill-add'); if(!add)return;
      const id=add.dataset.id, d=(typeof drillLibrary!=='undefined'?drillLibrary:[]).find(x=>x.id===id); if(!d)return;
      card.draggable=true; card.dataset.drillId=id;
      card.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/drill-id',id);e.dataTransfer.effectAllowed='copy'});
      if(!card.querySelector('.drill-stats')){const s=drillStats(d), node=document.createElement('div');node.className='drill-stats';node.innerHTML=`<span>Used <strong>${s.uses}</strong>×</span><span>Avg <strong>${s.avg} min</strong></span><span>Last <strong>${s.last?s.last.toLocaleDateString(undefined,{month:'short',day:'numeric'}):'Never'}</strong></span>`;card.querySelector('.drill-details')?.after(node)||card.querySelector('.drill-card-head')?.after(node)}
    });
  }
  function installDropZone(){
    const target=q('blocks'); if(!target || target.dataset.drillDrop==='1')return; target.dataset.drillDrop='1';
    const hint=document.createElement('div');hint.className='drill-drop-hint';hint.textContent='Drag drills here from the Library';target.parentNode.insertBefore(hint,target);
    ['dragenter','dragover'].forEach(type=>target.addEventListener(type,e=>{if(e.dataTransfer.types.includes('text/drill-id')){e.preventDefault();target.classList.add('drill-drop-active')}}));
    ['dragleave','drop'].forEach(type=>target.addEventListener(type,e=>{target.classList.remove('drill-drop-active')}));
    target.addEventListener('drop',e=>{const id=e.dataTransfer.getData('text/drill-id');if(!id)return;e.preventDefault(); if(typeof addDrillToPractice==='function')addDrillToPractice(id); showAppPage('builder');});
  }

  function installWhiteboard(){
    const nav=q('navTeam'); if(!nav||q('navWhiteboard'))return;
    const b=document.createElement('button');b.id='navWhiteboard';b.type='button';b.textContent='Whiteboard';nav.after(b);
    const page=document.createElement('section');page.id='whiteboardPage';page.className='page-view whiteboard-page';
    page.innerHTML=`<div class="whiteboard-toolbar"><div><h1>Wrestling Room Whiteboard</h1><p>Live messages for athletes, staff, or the TV display.</p></div><button class="primary" id="openWhiteboardTv">Open TV View</button></div><div class="whiteboard-editor"><label>Headline<input id="wbHeadline" maxlength="80" placeholder="Today's focus"></label><label>Goals / reminders<textarea id="wbGoals" rows="7" placeholder="Hand fight first&#10;Finish through the edge&#10;Great partners"></textarea></label><label>Athlete spotlight<input id="wbSpotlight" maxlength="100" placeholder="Optional athlete or group focus"></label></div><div class="whiteboard-display" id="whiteboardDisplay"></div>`;
    document.querySelector('.app')?.appendChild(page);
    const load=()=>{try{return JSON.parse(localStorage.getItem('wpp-whiteboard')||'{}')}catch{return {}}};
    const render=()=>{const d={headline:q('wbHeadline').value,goals:q('wbGoals').value,spotlight:q('wbSpotlight').value};localStorage.setItem('wpp-whiteboard',JSON.stringify(d));const logoSrc=document.querySelector('.brand img')?.src||'';q('whiteboardDisplay').innerHTML=`${logoSrc?`<img alt="" class="wb-logo" src="${logoSrc}">`:''}<div class="wb-kicker">WRESTLING ROOM</div><h2>${safe(d.headline||'Today’s Focus')}</h2><div class="wb-goals">${safe(d.goals||'Add goals and reminders for the room.').replace(/\n/g,'<br>')}</div>${d.spotlight?`<div class="wb-spotlight"><span>Spotlight</span>${safe(d.spotlight)}</div>`:''}`};
    const d=load();q('wbHeadline').value=d.headline||'';q('wbGoals').value=d.goals||'';q('wbSpotlight').value=d.spotlight||'';['wbHeadline','wbGoals','wbSpotlight'].forEach(id=>q(id).addEventListener('input',render));render();
    b.onclick=()=>showWhiteboard(); q('openWhiteboardTv').onclick=()=>{const u=new URL(location.href);u.searchParams.set('whiteboard','1');window.open(u,'wrestling-whiteboard','popup=yes,width=1400,height=900,resizable=yes')};
    if(new URLSearchParams(location.search).get('whiteboard')==='1'){document.body.classList.add('whiteboard-tv');showWhiteboard()}
  }
  function showWhiteboard(){
    ['builderPage','libraryPage','teamBoardPage','practiceDataPage','practiceQueuePage','drillLibraryPage'].forEach(id=>q(id)?.classList.remove('active'));
    q('builderPage')?.classList.add('hidden-page');q('whiteboardPage')?.classList.add('active');document.querySelectorAll('.page-nav button').forEach(x=>x.classList.toggle('active',x.id==='navWhiteboard'));window.scrollTo(0,0);
  }
  const originalShow=showAppPage; showAppPage=function(page){q('whiteboardPage')?.classList.remove('active');q('builderPage')?.classList.remove('hidden-page');document.body.classList.remove('whiteboard-tv');if(page==='whiteboard')return showWhiteboard();q('navWhiteboard')?.classList.remove('active');return originalShow(page)};
  const originalData=renderPracticeData; renderPracticeData=function(){originalData();renderAdvancedAnalytics()};
  const originalDrills=renderDrillLibrary; renderDrillLibrary=function(){originalDrills();enhanceDrillCards()};
  installAnalyticsUI();installDropZone();installWhiteboard();renderAdvancedAnalytics();enhanceDrillCards();
})();

/* Final whiteboard tab isolation fix. */
(() => {
  const hideWhiteboard = () => {
    const page = document.getElementById('whiteboardPage');
    if (page) page.classList.remove('active');
    document.getElementById('navWhiteboard')?.classList.remove('active');
    if (!new URLSearchParams(location.search).has('whiteboard')) {
      document.body.classList.remove('whiteboard-tv');
    }
  };
  document.addEventListener('click', (event) => {
    const navButton = event.target.closest('.page-nav button');
    if (navButton && navButton.id !== 'navWhiteboard') hideWhiteboard();
  }, true);
  window.addEventListener('hashchange', hideWhiteboard);
})();

/* ===== Home dashboard and visual practice timeline ===== */
(() => {
  const byId = id => document.getElementById(id);
  const safeText = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const archiveList = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('wpp-practice-library') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch { return []; }
  };
  const inboxList = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('wpp-coach-knowledge') || '{}');
      return Array.isArray(saved.practiceQueue) ? saved.practiceQueue : (typeof practiceQueue !== 'undefined' ? practiceQueue : []);
    } catch { return typeof practiceQueue !== 'undefined' ? practiceQueue : []; }
  };
  const archiveMinutes = a => (a.blocks || []).reduce((sum,b) => sum + Math.max(0, Number(b.minutes) || 0), 0);

  function installHome(){
    const nav = document.querySelector('.page-nav');
    if (!nav || byId('navHome')) return;
    const homeButton = document.createElement('button');
    homeButton.id = 'navHome';
    homeButton.type = 'button';
    homeButton.textContent = 'Home';
    nav.prepend(homeButton);

    const page = document.createElement('section');
    page.id = 'homePage';
    page.className = 'home-page page-view hidden-page';
    page.innerHTML = `
      <div class="home-hero">
        <section class="home-identity">
          <div class="home-eyebrow">Championship Standard</div>
          <h1>Holmen Women's Wrestling</h1>
          <div class="home-slogans"><span>For Her</span><span>Team State Champs</span></div>
        </section>
        <section class="home-today">
          <div><div class="home-today-label">Active Practice</div><div class="home-today-date" id="homePracticeDate">No date selected</div><div class="home-today-goal" id="homePracticeGoal">Set a goal in Practice Builder.</div></div>
          <button class="primary" id="homeContinueBtn" type="button">Continue Practice</button>
        </section>
      </div>
      <div class="home-grid">
        <div class="home-metric"><span>Season Practices</span><strong id="homePracticeCount">0</strong></div>
        <div class="home-metric"><span>Season Hours</span><strong id="homeSeasonHours">0</strong></div>
        <div class="home-metric"><span>Planned Today</span><strong id="homeTodayMinutes">0m</strong></div>
        <div class="home-metric"><span>Inbox</span><strong id="homeInboxCount">0</strong></div>
      </div>
      <div class="home-panels">
        <section class="home-panel"><h2>Quick Actions</h2><div class="home-quick-actions">
          <button class="primary" data-home-action="builder" type="button">Build Practice</button>
          <button class="secondary" data-home-action="coach" type="button">Open Coach Mode</button>
          <button class="secondary" data-home-action="team" type="button">Open Team Board</button>
          <button class="secondary" data-home-action="whiteboard" type="button">Open Whiteboard</button>
          <button class="secondary" data-home-action="queue" type="button">Inbox</button>
          <button class="secondary" data-home-action="data" type="button">Season Data</button>
        </div></section>
        <section class="home-panel"><h2>Recent Practices</h2><div id="homeRecentPractices"></div></section>
      </div>`;
    document.querySelector('.app')?.appendChild(page);
    homeButton.addEventListener('click', () => showAppPage('home'));
    byId('homeContinueBtn').addEventListener('click', () => showAppPage(state.practiceActive ? 'coach' : 'builder'));
    page.querySelectorAll('[data-home-action]').forEach(btn => btn.addEventListener('click', () => showAppPage(btn.dataset.homeAction)));
  }

  function renderHome(){
    const page = byId('homePage'); if (!page) return;
    const archives = archiveList().sort((a,b) => new Date(b.date || b.archivedAt || 0) - new Date(a.date || a.archivedAt || 0));
    const mins = archives.reduce((sum,a) => sum + archiveMinutes(a), 0);
    const inbox = inboxList().filter(item => !item.completedAt && !item.addressedAt);
    const dateValue = byId('practiceDate')?.value;
    byId('homePracticeDate').textContent = dateValue ? new Date(dateValue + 'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}) : 'No date selected';
    byId('homePracticeGoal').textContent = byId('practiceGoal')?.value?.trim() || 'Set a goal in Practice Builder.';
    byId('homePracticeCount').textContent = archives.length;
    byId('homeSeasonHours').textContent = (mins / 60).toFixed(mins >= 600 ? 0 : 1);
    byId('homeTodayMinutes').textContent = `${typeof total === 'function' ? total() : 0}m`;
    byId('homeInboxCount').textContent = inbox.length;
    const shortDate = value => {
      if (!value) return 'No date';
      const d = new Date(value + 'T12:00:00');
      if (Number.isNaN(d.getTime())) return value;
      const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
      const month = d.toLocaleDateString(undefined, { month: 'short' });
      return `${weekday}, ${month}. ${d.getDate()}, ${d.getFullYear()}`;
    };
    byId('homeRecentPractices').innerHTML = archives.length ? archives.slice(0,5).map(a => `<div class="home-recent-row" data-archive-id="${safeText(a.id)}"><div><strong>${safeText(a.goal || 'Practice')}</strong><br><span>${safeText(shortDate(a.date))}</span></div><strong>${archiveMinutes(a)}m</strong></div>`).join('') : '<div class="home-empty">Archived practices will appear here.</div>';
    byId('homeRecentPractices').querySelectorAll('.home-recent-row[data-archive-id]').forEach(row => {
      row.addEventListener('click', () => openArchiveCard(row.dataset.archiveId));
    });
  }

  function openArchiveCard(id){
    if (!id) return;
    showAppPage('library');
    const card = document.querySelector(`.archive-card[data-archive-id="${CSS?.escape ? CSS.escape(id) : id}"]`);
    if (card) {
      const month = card.closest('.archive-month');
      if (month) month.open = true;
      card.classList.add('open');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  window.openArchiveCard = openArchiveCard;

  function installTimeline(){
    const builder = byId('builderPage');
    if (!builder || byId('practiceTimelineCard')) return;
    const card = document.createElement('section');
    card.id = 'practiceTimelineCard';
    card.className = 'card practice-timeline-card';
    card.innerHTML = `<div class="timeline-heading"><div><h2>Practice Timeline</h2><p>Drag blocks to reorder. Use − / + to make quick time changes.</p></div><div class="timeline-range" id="timelineRange"></div></div><div class="practice-timeline" id="practiceTimeline"></div><div class="timeline-now-line"></div>`;
    builder.prepend(card);
  }

  function renderTimeline(){
    const timeline = byId('practiceTimeline'); if (!timeline) return;
    const start = typeof startMins === 'function' ? startMins() : 0;
    const planned = typeof total === 'function' ? total() : 0;
    byId('timelineRange').textContent = `${typeof clock === 'function' ? clock(start) : ''} – ${typeof clock === 'function' ? clock(start + planned) : ''}`;
    if (!state.blocks.length){timeline.innerHTML='<div class="timeline-empty">Add practice blocks to build the timeline.</div>';return;}
    let elapsed = 0;
    timeline.innerHTML = state.blocks.map((b,index) => {
      const begin = start + elapsed; elapsed += Number(b.minutes) || 0;
      const width = Math.max(115, Math.min(300, (Number(b.minutes)||1) * 8));
      const category = typeof categoryInfo === 'function' ? categoryInfo(b.category).label : b.category;
      return `<article class="timeline-segment" draggable="true" data-timeline-index="${index}" style="--timeline-width:${width}px;--timeline-grow:${Math.max(1,Number(b.minutes)||1)}"><div><div class="timeline-time">${clock(begin)}–${clock(start+elapsed)}</div><div class="timeline-name">${safeText(b.name)}</div><div class="timeline-category">${safeText(category)}</div></div><div class="timeline-duration-controls"><button class="secondary timeline-minus" data-i="${index}" type="button">−</button><strong>${Number(b.minutes)||0} min</strong><button class="secondary timeline-plus" data-i="${index}" type="button">+</button></div></article>`;
    }).join('');
    timeline.querySelectorAll('.timeline-minus').forEach(btn => btn.addEventListener('click', e => {e.stopPropagation(); const i=Number(btn.dataset.i); state.blocks[i].minutes=Math.max(1,(Number(state.blocks[i].minutes)||1)-1); render();}));
    timeline.querySelectorAll('.timeline-plus').forEach(btn => btn.addEventListener('click', e => {e.stopPropagation(); const i=Number(btn.dataset.i); state.blocks[i].minutes=(Number(state.blocks[i].minutes)||0)+1; render();}));
    timeline.querySelectorAll('.timeline-segment').forEach(seg => {
      seg.addEventListener('click', e => {if (!e.target.closest('button') && typeof openBlockModal === 'function') openBlockModal(Number(seg.dataset.timelineIndex));});
      seg.addEventListener('dragstart', e => {seg.classList.add('dragging'); e.dataTransfer.setData('text/timeline-index', seg.dataset.timelineIndex); e.dataTransfer.effectAllowed='move';});
      seg.addEventListener('dragend', () => timeline.querySelectorAll('.timeline-segment').forEach(x => x.classList.remove('dragging','drop-target')));
      seg.addEventListener('dragover', e => {e.preventDefault(); seg.classList.add('drop-target');});
      seg.addEventListener('dragleave', () => seg.classList.remove('drop-target'));
      seg.addEventListener('drop', e => {e.preventDefault(); const from=Number(e.dataTransfer.getData('text/timeline-index')), to=Number(seg.dataset.timelineIndex); if(Number.isInteger(from)&&Number.isInteger(to)&&from!==to){const [moved]=state.blocks.splice(from,1);state.blocks.splice(to,0,moved);render();}});
    });
  }

  installHome();
  installTimeline();
  const previousShow = showAppPage;
  showAppPage = function(page){
    const home = byId('homePage');
    if (page === 'home'){
      ['builderPage','libraryPage','teamBoardPage','practiceDataPage','practiceQueuePage','drillLibraryPage','whiteboardPage'].forEach(id => {byId(id)?.classList.remove('active'); if(id==='builderPage')byId(id)?.classList.add('hidden-page');});
      document.body.classList.remove('whiteboard-tv');
      home?.classList.remove('hidden-page');
      home?.classList.add('active');
      document.querySelectorAll('.page-nav button').forEach(btn => btn.classList.toggle('active',btn.id==='navHome'));
      renderHome(); window.scrollTo(0,0); return;
    }
    home?.classList.remove('active');
    home?.classList.add('hidden-page');
    byId('navHome')?.classList.remove('active');
    return previousShow(page);
  };
  const previousRender = render;
  render = function(){previousRender();renderTimeline();renderHome();};
  renderTimeline(); renderHome();
  const params = new URLSearchParams(location.search);
  const special = params.has('tv') || params.has('whiteboard') || params.has('code') || location.hash.startsWith('#practice=') || location.hash.startsWith('#p=');
  if (!special) showAppPage('home');
})();

/* ===== Practice Templates ===== */
(() => {
  const byId = id => document.getElementById(id);
  const safeText = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const KEY = 'wpp-practice-templates';
  const readTemplates = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const writeTemplates = list => { localStorage.setItem(KEY, JSON.stringify(list)); renderList(); };

  function buildModal(){
    if (byId('templatesBackdrop')) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.id = 'templatesBackdrop';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = `<section class="block-modal templates-modal" role="dialog" aria-modal="true" aria-labelledby="templatesTitle">
      <h2 id="templatesTitle">Practice Templates</h2>
      <div class="template-save-row">
        <input id="templateNameInput" type="text" placeholder="Template name (e.g. Tuesday Live Wrestling)">
        <button class="primary" id="saveTemplateBtn" type="button">Save Current</button>
      </div>
      <div class="template-list" id="templateList"></div>
      <div class="modal-actions" style="grid-template-columns:1fr">
        <button class="secondary" id="closeTemplatesBtn" type="button">Close</button>
      </div>
    </section>`;
    document.querySelector('.app')?.appendChild(wrap);
    byId('saveTemplateBtn').addEventListener('click', saveCurrentAsTemplate);
    byId('closeTemplatesBtn').addEventListener('click', closeModal);
    wrap.addEventListener('click', e => { if (e.target === wrap) closeModal(); });
    byId('templateNameInput').addEventListener('keydown', e => { if (e.key === 'Enter') saveCurrentAsTemplate(); });
  }

  function openModal(){ buildModal(); renderList(); byId('templatesBackdrop').classList.add('open'); byId('templatesBackdrop').setAttribute('aria-hidden','false'); }
  function closeModal(){ byId('templatesBackdrop')?.classList.remove('open'); byId('templatesBackdrop')?.setAttribute('aria-hidden','true'); }

  function saveCurrentAsTemplate(){
    if (!Array.isArray(state.blocks) || !state.blocks.length) { alert('Add at least one practice block before saving a template.'); return; }
    const nameInput = byId('templateNameInput');
    const name = (nameInput.value || '').trim() || `Template ${new Date().toLocaleDateString()}`;
    const list = readTemplates();
    const existing = list.find(t => (t.name || '').trim().toLowerCase() === name.toLowerCase());
    const replace = existing && confirm(`A template named "${name}" already exists. Replace it?\n\nCancel to save this as a separate new template instead.`);
    const template = {
      id: replace ? existing.id : (crypto.randomUUID?.() || String(Date.now())),
      name,
      goal: byId('practiceGoal')?.value || '',
      length: Number(byId('practiceLength')?.value) || (typeof total === 'function' ? total() : 90),
      blocks: state.blocks.map(b => ({ name: b.name, minutes: Number(b.minutes) || 1, details: b.details || '', reps: b.reps || '', circuit: Array.isArray(b.circuit) ? b.circuit : [], category: b.category || 'other' })),
      createdAt: replace ? (existing.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: replace ? new Date().toISOString() : undefined
    };
    let newList;
    if (replace) {
      newList = list.map(t => t.id === existing.id ? template : t);
    } else {
      newList = [template, ...list];
    }
    writeTemplates(newList);
    nameInput.value = '';
  }

  function applyTemplate(id, { replace } = { replace: true }){
    const t = readTemplates().find(x => x.id === id);
    if (!t) return;
    if (replace && state.blocks.length && !confirm('Replace the current practice blocks with this template?')) return;
    const newBlocks = t.blocks.map(b => ({ id: crypto.randomUUID(), name: b.name, minutes: Number(b.minutes) || 1, details: b.details || '', reps: b.reps || '', circuit: Array.isArray(b.circuit) ? b.circuit.map(x => ({ id: crypto.randomUUID(), name: x.name || '', reps: x.reps || '' })) : [], category: b.category || 'other', coachNotes: '', completionStatus: 'not_completed', actualMinutes: Number(b.minutes) || 1 }));
    state.blocks = replace ? newBlocks : [...state.blocks, ...newBlocks];
    if (t.goal && byId('practiceGoal')) byId('practiceGoal').value = t.goal;
    if (t.length && byId('practiceLength')) byId('practiceLength').value = t.length;
    render(); save();
    closeModal();
    showAppPage('builder');
  }

  function deleteTemplate(id){
    const t = readTemplates().find(x => x.id === id);
    if (!t || !confirm(`Delete the "${t.name}" template?`)) return;
    writeTemplates(readTemplates().filter(x => x.id !== id));
  }

  function renderList(){
    const list = byId('templateList'); if (!list) return;
    const templates = readTemplates();
    list.innerHTML = templates.length ? templates.map(t => `<div class="template-card"><div><div class="template-card-name">${safeText(t.name)}</div><div class="template-card-meta">${t.blocks.length} block${t.blocks.length === 1 ? '' : 's'} · ${t.length || t.blocks.reduce((s,b)=>s+(Number(b.minutes)||0),0)} min${t.goal ? ' · ' + safeText(t.goal) : ''}</div></div><div class="template-card-actions"><button class="secondary" data-template-use="${t.id}" type="button">Use</button><button class="danger" data-template-delete="${t.id}" type="button">Delete</button></div></div>`).join('') : '<div class="template-empty">No saved templates yet. Build a practice, then save it as a template.</div>';
    list.querySelectorAll('[data-template-use]').forEach(b => b.addEventListener('click', () => applyTemplate(b.dataset.templateUse)));
    list.querySelectorAll('[data-template-delete]').forEach(b => b.addEventListener('click', () => deleteTemplate(b.dataset.templateDelete)));
  }

  function installButton(){
    const actions = document.querySelector('#builderPage .actions');
    if (!actions || byId('templatesBtn')) return;
    const btn = document.createElement('button');
    btn.className = 'secondary';
    btn.id = 'templatesBtn';
    btn.type = 'button';
    btn.textContent = 'Templates';
    btn.addEventListener('click', openModal);
    actions.insertAdjacentElement('afterend', btn);
  }

  window.wppTemplates = { list: readTemplates, apply: applyTemplate, open: openModal, save: saveCurrentAsTemplate, remove: deleteTemplate };

  const start = () => installButton();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* ===== Universal Search (Ctrl+K / Cmd+K) ===== */
(() => {
  const byId = id => document.getElementById(id);
  const safeText = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const readJson = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v ?? fallback; } catch { return fallback; } };

  const PAGES = [
    { label: 'Home', sub: 'Dashboard and overview', page: 'home' },
    { label: 'Practice Builder', sub: "Build today's practice", page: 'builder' },
    { label: 'Coach Mode', sub: 'Run practice with the timer', page: 'coach' },
    { label: 'Team Board', sub: 'Display the plan for the team', page: 'team' },
    { label: 'Whiteboard', sub: 'TV whiteboard view', page: 'whiteboard' },
    { label: 'Archive', sub: 'Past practices', page: 'library' },
    { label: 'Data', sub: 'Season practice data', page: 'data' },
    { label: 'Inbox', sub: 'Items queued for a future practice', page: 'queue' },
    { label: 'Library', sub: 'Saved drills', page: 'drills' }
  ];

  function buildModal(){
    if (byId('cmdkBackdrop')) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.id = 'cmdkBackdrop';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = `<section class="block-modal cmdk-modal" role="dialog" aria-modal="true" aria-label="Universal search">
      <div class="cmdk-input-row"><input id="cmdkInput" type="text" placeholder="Search practices, drills, inbox, templates, pages…" autocomplete="off"></div>
      <div class="cmdk-results" id="cmdkResults"></div>
      <div class="cmdk-hint"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>Enter</kbd> Open</span><span><kbd>Esc</kbd> Close</span></div>
    </section>`;
    document.querySelector('.app')?.appendChild(wrap);
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    const input = byId('cmdkInput');
    input.addEventListener('input', () => renderResults(input.value));
    input.addEventListener('keydown', onKeydown);
  }

  function buildIndex(){
    const items = [];
    PAGES.forEach(p => items.push({ type: 'Page', label: p.label, sub: p.sub, action: () => showAppPage(p.page) }));

    const archives = readJson('wpp-practice-library', []);
    (Array.isArray(archives) ? archives : []).forEach(a => {
      const dateLabel = typeof archiveDateLabel === 'function' ? archiveDateLabel(a) : (a.date || 'Undated practice');
      items.push({
        type: 'Practice',
        label: a.goal ? a.goal : dateLabel,
        sub: `${dateLabel}${a.goal ? '' : ''}`.trim(),
        action: () => { close(); window.openArchiveCard(a.id); }
      });
    });

    const drills = readJson('wpp-drill-library', []);
    (Array.isArray(drills) ? drills : []).forEach(d => {
      items.push({
        type: 'Drill',
        label: d.name || 'Untitled drill',
        sub: `${d.minutes || 0} min${d.tags ? ' · ' + d.tags : ''}`,
        action: () => { close(); showAppPage('drills'); const s = byId('drillSearch'); if (s) { s.value = d.name || ''; s.dispatchEvent(new Event('input')); } }
      });
    });

    const inbox = readJson('wpp-practice-queue', []);
    (Array.isArray(inbox) ? inbox : []).forEach(q => {
      items.push({
        type: 'Inbox',
        label: q.title || 'Untitled item',
        sub: `Added by ${q.addedBy || 'Coach'}`,
        action: () => { close(); showAppPage('queue'); const s = byId('queueSearch'); if (s) { s.value = q.title || ''; s.dispatchEvent(new Event('input')); } }
      });
    });

    const templates = (window.wppTemplates && typeof window.wppTemplates.list === 'function') ? window.wppTemplates.list() : readJson('wpp-practice-templates', []);
    (Array.isArray(templates) ? templates : []).forEach(t => {
      items.push({
        type: 'Template',
        label: t.name || 'Untitled template',
        sub: `${(t.blocks || []).length} blocks`,
        action: () => { close(); if (window.wppTemplates) window.wppTemplates.apply(t.id); }
      });
    });

    return items;
  }

  let activeIndex = 0;
  let currentResults = [];

  function renderResults(query){
    const list = byId('cmdkResults');
    const q = (query || '').trim().toLowerCase();
    const all = buildIndex();
    currentResults = q ? all.filter(item => `${item.label} ${item.sub} ${item.type}`.toLowerCase().includes(q)) : all.slice(0, 9);
    currentResults = currentResults.slice(0, 30);
    activeIndex = 0;
    if (!currentResults.length){
      list.innerHTML = '<div class="cmdk-empty">No matches. Try a different search.</div>';
      return;
    }
    list.innerHTML = currentResults.map((item, i) => `<div class="cmdk-item${i === activeIndex ? ' active' : ''}" data-i="${i}"><div><strong>${safeText(item.label)}</strong>${item.sub ? `<span class="cmdk-sub">${safeText(item.sub)}</span>` : ''}</div><span class="cmdk-tag">${safeText(item.type)}</span></div>`).join('');
    list.querySelectorAll('.cmdk-item').forEach(el => {
      el.addEventListener('click', () => { const item = currentResults[Number(el.dataset.i)]; if (item) item.action(); });
      el.addEventListener('mouseenter', () => setActive(Number(el.dataset.i)));
    });
  }

  function setActive(i){
    activeIndex = Math.max(0, Math.min(currentResults.length - 1, i));
    byId('cmdkResults').querySelectorAll('.cmdk-item').forEach(el => el.classList.toggle('active', Number(el.dataset.i) === activeIndex));
    byId('cmdkResults').querySelector('.cmdk-item.active')?.scrollIntoView({ block: 'nearest' });
  }

  function onKeydown(e){
    if (e.key === 'ArrowDown'){ e.preventDefault(); setActive(activeIndex + 1); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); setActive(activeIndex - 1); }
    else if (e.key === 'Enter'){ e.preventDefault(); const item = currentResults[activeIndex]; if (item) item.action(); }
    else if (e.key === 'Escape'){ e.preventDefault(); close(); }
  }

  function open(){
    buildModal();
    byId('cmdkBackdrop').classList.add('open');
    byId('cmdkBackdrop').setAttribute('aria-hidden', 'false');
    const input = byId('cmdkInput');
    input.value = '';
    renderResults('');
    setTimeout(() => input.focus(), 0);
  }

  function close(){
    byId('cmdkBackdrop')?.classList.remove('open');
    byId('cmdkBackdrop')?.setAttribute('aria-hidden', 'true');
  }

  function installTrigger(){
    const header = document.querySelector('.header');
    if (!header || byId('cmdkOpenBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'cmdkOpenBtn';
    btn.type = 'button';
    btn.className = 'cmdk-trigger';
    btn.innerHTML = '🔍 Search <kbd>Ctrl K</kbd>';
    btn.addEventListener('click', open);
    header.appendChild(btn);
  }

  document.addEventListener('keydown', e => {
    const key = (e.key || '').toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 'k'){
      e.preventDefault();
      const isOpen = byId('cmdkBackdrop')?.classList.contains('open');
      if (isOpen) close(); else open();
    }
  });

  const start = () => installTrigger();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* ===== Resizable Coach Mode columns ===== */
(() => {
  const KEY = 'wpp-coach-columns';
  const MINS = [250, 300, 340];
  const DEFAULT_RATIOS = [0.72, 1, 1.1];

  function loadRatios() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && n > 0)) return v;
    } catch {}
    return [...DEFAULT_RATIOS];
  }
  function saveRatios(r) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch {} }
  function applyRatios(grid, r) {
    grid.style.gap = '0';
    grid.style.gridTemplateColumns = `minmax(${MINS[0]}px, ${r[0]}fr) 10px minmax(${MINS[1]}px, ${r[1]}fr) 10px minmax(${MINS[2]}px, ${r[2]}fr)`;
  }

  function makeHandle(index) {
    const h = document.createElement('div');
    h.className = 'dash-resize-handle';
    h.dataset.index = String(index);
    h.setAttribute('role', 'separator');
    h.setAttribute('aria-orientation', 'vertical');
    h.setAttribute('aria-label', 'Resize columns');
    h.tabIndex = 0;
    return h;
  }

  function wireHandle(h, grid, panels, getRatios, setRatios) {
    let dragging = false, startX = 0, startWidths = null;
    const pointX = e => (e.touches ? e.touches[0].clientX : e.clientX);
    const onMove = e => {
      if (!dragging) return;
      const delta = pointX(e) - startX;
      const i = Number(h.dataset.index);
      const widths = [...startWidths];
      widths[i] = Math.max(MINS[i], startWidths[i] + delta);
      widths[i + 1] = Math.max(MINS[i + 1], startWidths[i + 1] - delta);
      setRatios(widths);
      applyRatios(grid, widths);
      if (e.cancelable) e.preventDefault();
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove('dash-resizing');
      saveRatios(getRatios());
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    const onDown = e => {
      dragging = true;
      document.body.classList.add('dash-resizing');
      startX = pointX(e);
      startWidths = panels.map(p => p.getBoundingClientRect().width);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onUp);
      e.preventDefault();
    };
    h.addEventListener('mousedown', onDown);
    h.addEventListener('touchstart', onDown, { passive: false });
    h.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const i = Number(h.dataset.index);
      const widths = panels.map(p => p.getBoundingClientRect().width);
      const dir = e.key === 'ArrowLeft' ? -1 : 1;
      const step = 20;
      widths[i] = Math.max(MINS[i], widths[i] + dir * step);
      widths[i + 1] = Math.max(MINS[i + 1], widths[i + 1] - dir * step);
      setRatios(widths);
      applyRatios(grid, widths);
      saveRatios(widths);
    });
  }

  function install() {
    const grid = document.querySelector('.dash-grid');
    if (!grid || grid.dataset.resizable === '1') return;
    const panels = [...grid.querySelectorAll(':scope > .panel')];
    if (panels.length !== 3) return;
    grid.dataset.resizable = '1';
    let ratios = loadRatios();
    applyRatios(grid, ratios);
    const h0 = makeHandle(0), h1 = makeHandle(1);
    panels[0].after(h0);
    panels[1].after(h1);
    const getRatios = () => ratios;
    const setRatios = r => { ratios = r; };
    wireHandle(h0, grid, panels, getRatios, setRatios);
    wireHandle(h1, grid, panels, getRatios, setRatios);
  }

  const start = () => install();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* ===== Relocate Spotify player to fill the practice column + remember collapsed state ===== */
(() => {
  function relocateSpotify() {
    const anchor = document.querySelector('#timerPanel .compact-timer-section');
    const spotifyBox = document.getElementById('spotifyBox');
    if (!anchor || !spotifyBox || spotifyBox.dataset.relocated === '1') return false;
    spotifyBox.dataset.relocated = '1';
    anchor.after(spotifyBox);
    return true;
  }

  function wireCollapsePersistence(el, key) {
    if (!el || el.dataset.collapseWired === '1') return;
    el.dataset.collapseWired = '1';
    try { if (localStorage.getItem(key) === '1') el.open = true; } catch {}
    el.addEventListener('toggle', () => { try { localStorage.setItem(key, el.open ? '1' : '0'); } catch {} });
  }

  function install() {
    const moved = relocateSpotify();
    wireCollapsePersistence(document.getElementById('spotifyBox'), 'wpp-spotify-open');
    wireCollapsePersistence(document.getElementById('coachPracticeInbox'), 'wpp-coach-inbox-open');
    wireCollapsePersistence(document.getElementById('coachNotesPanel'), 'wpp-coach-notes-open');
    return moved;
  }

  const start = () => install();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  // Practice Inbox panel is created slightly after DOMContentLoaded in some load orders; retry briefly.
  let attempts = 0;
  const retry = setInterval(() => {
    attempts++;
    if (install() || attempts > 20) clearInterval(retry);
  }, 150);
})();

/* ===== Practice Plan QR code in Coach Mode ===== */
(() => {
  function renderQr() {
    const img = document.getElementById('practiceQrCanvas');
    const linkInput = document.getElementById('qrLinkInput');
    const hint = document.getElementById('qrSummaryHint');
    if (!img) return;
    const url = typeof window.currentPracticeTvUrl === 'function' ? window.currentPracticeTvUrl() : '';
    if (!url) { if (hint) hint.textContent = 'Could not build a link.'; return; }
    if (linkInput) linkInput.value = url;
    if (hint) hint.textContent = 'Loading QR code…';
    img.onload = () => { if (hint) hint.textContent = ''; };
    img.onerror = () => { if (hint) hint.textContent = 'Could not generate QR code. Check your connection.'; };
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=176x176&margin=8&data=' + encodeURIComponent(url);
  }
  function wire() {
    const box = document.getElementById('qrBox');
    if (!box || box.dataset.qrWired === '1') return;
    box.dataset.qrWired = '1';
    box.addEventListener('toggle', () => { if (box.open) renderQr(); });
    const copyBtn = document.getElementById('qrCopyBtn');
    if (copyBtn) copyBtn.addEventListener('click', async () => {
      const input = document.getElementById('qrLinkInput');
      if (!input || !input.value) return;
      try {
        await navigator.clipboard.writeText(input.value);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 1500);
      } catch {
        input.select();
        document.execCommand('copy');
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 1500);
      }
    });
  }
  const start = () => wire();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* ===== Team Look & Home Page Customization ===== */
(() => {
  const KEY = 'wpp-brand-settings';
  const TEMPLATES_KEY = 'wpp-look-templates';
  const q = id => document.getElementById(id);

  const DEFAULT_TEXT = {
    eyebrow: 'Championship Standard',
    slogan1: 'For Her',
    slogan2: 'Team State Champs'
  };
  const TEXT_LABELS = {
    eyebrow: 'Eyebrow tag',
    slogan1: 'Slogan 1',
    slogan2: 'Slogan 2'
  };
  const DEFAULT_PRIMARY = '#741d2a';

  function shade(hex, percent) {
    try {
      const clean = String(hex || '').replace('#', '');
      const n = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
      if (Number.isNaN(n)) return hex;
      let r = (n >> 16) + Math.round(255 * percent);
      let g = ((n >> 8) & 0xff) + Math.round(255 * percent);
      let b = (n & 0xff) + Math.round(255 * percent);
      r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
      return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
    } catch { return hex; }
  }

  function start() {
    const home = q('homePage');
    if (!home || q('homeSettingsBtn')) return false;

    const DEFAULT_LOGO = document.querySelector('.brand img')?.src || '';
    const DEFAULT_NAME = document.querySelector('.brand h1')?.textContent?.trim() || "Holmen Women's Wrestling";

    const defaults = () => ({ teamName: DEFAULT_NAME, logo: '', primary: DEFAULT_PRIMARY, text: { ...DEFAULT_TEXT } });

    function load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return defaults();
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return defaults();
        return { ...defaults(), ...parsed, text: { ...DEFAULT_TEXT, ...(parsed.text || {}) } };
      } catch { return defaults(); }
    }
    const persist = settings => localStorage.setItem(KEY, JSON.stringify(settings));

    function loadTemplates() {
      try {
        const raw = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
        return Array.isArray(raw) ? raw : [];
      } catch { return []; }
    }
    const persistTemplates = list => localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));

    function apply(settings) {
      const primary = settings.primary || DEFAULT_PRIMARY;
      document.documentElement.style.setProperty('--maroon', primary);
      document.documentElement.style.setProperty('--maroon2', shade(primary, -0.25));
      document.documentElement.style.setProperty('--accent', shade(primary, 0.1));

      const name = settings.teamName || DEFAULT_NAME;
      document.querySelectorAll('.brand h1, .dash-brand-title, .team-board-title h2, .home-identity h1').forEach(el => { if (el) el.textContent = name; });

      const logoSrc = settings.logo || DEFAULT_LOGO;
      if (logoSrc) document.querySelectorAll('.brand img, .dash-brand img').forEach(el => { if (el) el.src = logoSrc; });

      const t = { ...DEFAULT_TEXT, ...(settings.text || {}) };
      const setText = sel => { const el = home.querySelector(sel); return val => { if (el) el.textContent = val; }; };
      setText('.home-eyebrow')(t.eyebrow);
      const slogans = home.querySelectorAll('.home-slogans span');
      if (slogans[0]) slogans[0].textContent = t.slogan1;
      if (slogans[1]) slogans[1].textContent = t.slogan2;
    }

    let current = load();
    apply(current);

    const gearBtn = document.createElement('button');
    gearBtn.id = 'homeSettingsBtn';
    gearBtn.type = 'button';
    gearBtn.className = 'home-settings-btn';
    gearBtn.setAttribute('aria-label', 'Customize team look');
    gearBtn.title = 'Customize team look';
    gearBtn.textContent = '⚙';
    const identitySection = home.querySelector('.home-identity');
    if (identitySection) identitySection.appendChild(gearBtn); else home.prepend(gearBtn);

    const backdrop = document.createElement('div');
    backdrop.id = 'brandSettingsBackdrop';
    backdrop.className = 'modal-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    const textFieldsHtml = Object.keys(DEFAULT_TEXT).map(k => `<label class="field brand-text-field">${TEXT_LABELS[k]}<input id="txt-${k}" maxlength="60" type="text"></label>`).join('');
    backdrop.innerHTML = `<section aria-label="Customize team look" aria-modal="true" class="block-modal brand-settings-modal" role="dialog">
      <h2>Customize Team Look</h2>
      <section class="brand-section">
        <h3>Team Identity</h3>
        <label class="field">Team name<input id="brandTeamName" maxlength="60" type="text"></label>
        <label class="field">Logo<input accept="image/*" id="brandLogoInput" type="file"></label>
        <div class="logo-preview-row"><img alt="Logo preview" id="brandLogoPreview"><button class="secondary" id="brandLogoResetBtn" type="button">Reset to Default Logo</button></div>
      </section>
      <section class="brand-section">
        <h3>Color</h3>
        <label class="field color-field">Team color<input id="brandPrimaryColor" type="color"></label>
      </section>
      <section class="brand-section">
        <h3>Home Page Text</h3>
        <div class="brand-text-grid">${textFieldsHtml}</div>
      </section>
      <section class="brand-section">
        <h3>Look Templates</h3>
        <p class="brand-template-help">Save the current name, logo, colors, and text as a named look you can switch back to anytime.</p>
        <div class="template-save-row"><input id="brandTemplateName" maxlength="40" placeholder="Look name (e.g. Home, Away)" type="text"><button class="secondary" id="brandSaveTemplateBtn" type="button">Save Current as Template</button></div>
        <div class="template-list" id="brandTemplateList"></div>
      </section>
      <div class="brand-modal-actions">
        <button class="secondary" id="brandResetBtn" type="button">Reset to Default</button>
        <button class="secondary" id="brandCancelBtn" type="button">Cancel</button>
        <button class="primary" id="brandSaveBtn" type="button">Save</button>
      </div>
    </section>`;
    document.querySelector('.app')?.appendChild(backdrop);

    let draft = null;

    function fillForm(settings) {
      if (q('brandTeamName')) q('brandTeamName').value = settings.teamName || '';
      if (q('brandLogoPreview')) q('brandLogoPreview').src = settings.logo || DEFAULT_LOGO;
      if (q('brandPrimaryColor')) q('brandPrimaryColor').value = settings.primary || DEFAULT_PRIMARY;
      const t = { ...DEFAULT_TEXT, ...(settings.text || {}) };
      Object.keys(DEFAULT_TEXT).forEach(k => { const el = q('txt-' + k); if (el) el.value = t[k]; });
    }

    function readForm() {
      const text = {};
      Object.keys(DEFAULT_TEXT).forEach(k => { const el = q('txt-' + k); text[k] = el ? el.value : DEFAULT_TEXT[k]; });
      return {
        teamName: (q('brandTeamName')?.value || '').trim() || DEFAULT_NAME,
        logo: (draft && draft.logo) || '',
        primary: q('brandPrimaryColor')?.value || DEFAULT_PRIMARY,
        text
      };
    }

    function renderTemplates() {
      const list = loadTemplates();
      const wrap = q('brandTemplateList');
      if (!wrap) return;
      wrap.innerHTML = list.length ? list.map(tpl => `<div class="template-row" data-id="${esc(tpl.id)}"><span>${esc(tpl.name)}</span><div class="template-row-actions"><button class="secondary template-apply-btn" data-id="${esc(tpl.id)}" type="button">Apply</button><button class="secondary template-delete-btn" data-id="${esc(tpl.id)}" type="button">Delete</button></div></div>`).join('') : '<div class="template-empty">No saved looks yet.</div>';
      wrap.querySelectorAll('.template-apply-btn').forEach(btn => btn.onclick = () => {
        const tpl = loadTemplates().find(x => x.id === btn.dataset.id);
        if (!tpl || !tpl.settings) return;
        draft = { ...defaults(), ...tpl.settings, text: { ...DEFAULT_TEXT, ...(tpl.settings.text || {}) } };
        fillForm(draft);
      });
      wrap.querySelectorAll('.template-delete-btn').forEach(btn => btn.onclick = () => {
        if (!confirm('Delete this saved look?')) return;
        persistTemplates(loadTemplates().filter(x => x.id !== btn.dataset.id));
        renderTemplates();
      });
    }

    function openModal() {
      current = load();
      draft = { ...current, text: { ...current.text } };
      fillForm(current);
      renderTemplates();
      backdrop.classList.add('open');
      backdrop.setAttribute('aria-hidden', 'false');
    }
    function closeModal() {
      backdrop.classList.remove('open');
      backdrop.setAttribute('aria-hidden', 'true');
    }

    gearBtn.addEventListener('click', openModal);
    q('brandCancelBtn')?.addEventListener('click', closeModal);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });

    q('brandLogoInput')?.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        draft = draft || {};
        draft.logo = reader.result;
        if (q('brandLogoPreview')) q('brandLogoPreview').src = reader.result;
      };
      reader.readAsDataURL(file);
    });
    q('brandLogoResetBtn')?.addEventListener('click', () => {
      draft = draft || {};
      draft.logo = '';
      if (q('brandLogoPreview')) q('brandLogoPreview').src = DEFAULT_LOGO;
    });

    q('brandSaveTemplateBtn')?.addEventListener('click', () => {
      const nameInput = q('brandTemplateName');
      const name = (nameInput?.value || '').trim();
      if (!name) { alert('Enter a name for this look before saving.'); return; }
      const settings = readForm();
      const list = loadTemplates();
      list.unshift({ id: 'tpl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), name, savedAt: new Date().toISOString(), settings });
      persistTemplates(list);
      if (nameInput) nameInput.value = '';
      renderTemplates();
    });

    q('brandResetBtn')?.addEventListener('click', () => {
      if (!confirm('Reset to the default team look? This does not delete your saved templates.')) return;
      draft = defaults();
      fillForm(draft);
    });

    q('brandSaveBtn')?.addEventListener('click', () => {
      const settings = readForm();
      current = settings;
      persist(settings);
      apply(settings);
      closeModal();
    });

    return true;
  }

  const boot = () => start();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  let brandAttempts = 0;
  const brandRetry = setInterval(() => {
    brandAttempts++;
    if (start() || brandAttempts > 20) clearInterval(brandRetry);
  }, 150);
})();

/* ===== Attendance Tracker ===== */
(() => {
  const ROSTER_KEY = 'wpp-roster';
  const ATTENDANCE_KEY = 'wpp-attendance';
  const q = id => document.getElementById(id);

  function loadRoster() {
    try { const raw = JSON.parse(localStorage.getItem(ROSTER_KEY) || '[]'); return Array.isArray(raw) ? raw : []; } catch { return []; }
  }
  const saveRoster = list => localStorage.setItem(ROSTER_KEY, JSON.stringify(list));
  function loadAttendance() {
    try { const raw = JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || '{}'); return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {}; } catch { return {}; }
  }
  const saveAttendance = obj => localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(obj));

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function formatDate(dateStr) {
    try {
      const d = new Date(dateStr + 'T12:00:00');
      if (Number.isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    } catch { return dateStr; }
  }
  function attendanceRate(athleteId, attendance) {
    let present = 0, total = 0;
    Object.keys(attendance).forEach(date => {
      const rec = attendance[date] && attendance[date][athleteId];
      if (rec === 'present' || rec === 'absent') { total++; if (rec === 'present') present++; }
    });
    return total ? Math.round((present / total) * 100) : null;
  }

  function currentPracticeDate() {
    return (document.getElementById('practiceDate')?.value || '').trim() || todayStr();
  }
  function isAttendanceDoneForDate(date) {
    const roster = loadRoster().filter(a => a.active !== false);
    if (!roster.length) return true;
    return !!loadAttendance()[date];
  }

  function start() {
    const home = q('homePage');
    if (!home || q('homeAttendancePanel')) return false;

    const section = document.createElement('section');
    section.id = 'homeAttendancePanel';
    section.className = 'home-panel home-attendance-panel';
    section.innerHTML = `<h2>Attendance</h2>
      <div class="attendance-alert-slot" id="attendanceAlertSlot"></div>
      <div class="attendance-summary" id="attendanceSummary"></div>
      <div class="attendance-panel-actions"><button class="primary" id="takeAttendanceBtn" type="button">Take Attendance</button></div>`;
    const heroWrap = home.querySelector('.home-hero');
    if (heroWrap) heroWrap.after(section); else home.prepend(section);

    const coachTop = document.querySelector('#timerPanel .dash-top');
    const coachPdfBox = document.getElementById('coachPdfReminder');
    let coachReminder = null;
    if (coachTop) {
      coachReminder = document.createElement('div');
      coachReminder.id = 'coachAttendanceReminder';
      coachReminder.className = 'coach-pdf-reminder coach-attendance-reminder';
      coachReminder.hidden = true;
      coachReminder.innerHTML = `<div class="coach-pdf-copy"><strong>Attendance not taken</strong><span>Mark who's here for this practice.</span></div>
        <div class="coach-pdf-actions"><button class="primary" id="coachAttendanceBtn" type="button">Take Attendance</button></div>`;
      if (coachPdfBox) coachPdfBox.after(coachReminder); else coachTop.after(coachReminder);
    }

    function renderAlert() {
      const slot = q('attendanceAlertSlot');
      if (!slot) return;
      const date = currentPracticeDate();
      slot.innerHTML = isAttendanceDoneForDate(date) ? '' : `<div class="attendance-alert">Attendance not yet taken for ${esc(formatDate(date))}.</div>`;
    }
    function renderCoachReminder() {
      if (!coachReminder) return;
      coachReminder.hidden = isAttendanceDoneForDate(currentPracticeDate());
    }

    function computeAttendanceStats() {
      const roster = loadRoster().filter(a => a.active !== false);
      const attendance = loadAttendance();
      const dates = Object.keys(attendance).sort();
      const perAthlete = roster.map(a => {
        let present = 0, absent = 0;
        dates.forEach(d => {
          const rec = attendance[d] ? attendance[d][a.id] : undefined;
          if (rec === 'present') present++; else if (rec === 'absent') absent++;
        });
        const total = present + absent;
        return { id: a.id, name: a.name, present, absent, total, percent: total ? Math.round((present / total) * 100) : null };
      });
      const withRecords = perAthlete.filter(a => a.total > 0);
      const teamAttendancePercent = withRecords.length ? Math.round(withRecords.reduce((s, a) => s + a.percent, 0) / withRecords.length) : null;
      const missedTotal = perAthlete.reduce((s, a) => s + a.absent, 0);
      let perfectDays = 0;
      dates.forEach(d => {
        const rec = attendance[d] || {};
        const vals = Object.values(rec).filter(v => v === 'present' || v === 'absent');
        if (vals.length && vals.every(v => v === 'present')) perfectDays++;
      });
      const perfectDaysPercent = dates.length ? Math.round((perfectDays / dates.length) * 100) : null;
      const perfectIndividuals = withRecords.filter(a => a.absent === 0);
      return { perAthlete, totalPractices: dates.length, teamAttendancePercent, missedTotal, perfectDays, perfectDaysPercent, perfectIndividuals };
    }

    function installDataCard() {
      const page = document.getElementById('practiceDataPage');
      if (!page || document.getElementById('attendanceDataCard')) return false;
      const card = document.createElement('section');
      card.className = 'data-card season-attendance-card';
      card.id = 'attendanceDataCard';
      card.innerHTML = `<h2>Attendance</h2>
        <div class="attendance-stats-grid" id="attendanceStatsGrid"></div>
        <details class="trend-chart-block" open><summary><h3>Perfect Attendance</h3></summary><div id="attendancePerfectList"></div></details>
        <details class="trend-chart-block" open><summary><h3>By Athlete</h3></summary><div class="attendance-table-wrap" id="attendanceByAthlete"></div></details>`;
      const anchor = page.querySelector('.season-culture-card') || page.querySelector('.season-ratings-card');
      if (anchor) anchor.after(card); else page.prepend(card);
      return true;
    }

    function renderDataCard() {
      const grid = document.getElementById('attendanceStatsGrid');
      if (!grid) return;
      const s = computeAttendanceStats();
      grid.innerHTML = `<div class="attendance-metric"><span>Team Attendance</span><strong>${s.teamAttendancePercent === null ? '—' : s.teamAttendancePercent + '%'}</strong></div>
        <div class="attendance-metric"><span>Total Practices</span><strong>${s.totalPractices}</strong></div>
        <div class="attendance-metric"><span>Missed Practices</span><strong>${s.missedTotal}</strong></div>
        <div class="attendance-metric"><span>Perfect Attendance Days</span><strong>${s.perfectDays}${s.perfectDaysPercent === null ? '' : ' (' + s.perfectDaysPercent + '%)'}</strong></div>`;

      const perfectWrap = document.getElementById('attendancePerfectList');
      if (perfectWrap) {
        perfectWrap.innerHTML = s.perfectIndividuals.length
          ? `<div class="attendance-perfect-count">${s.perfectIndividuals.length} athlete${s.perfectIndividuals.length === 1 ? '' : 's'} with perfect attendance</div><div class="attendance-perfect-names">${s.perfectIndividuals.map(a => `<span class="attendance-perfect-chip">${esc(a.name)}</span>`).join('')}</div>`
          : '<div class="attendance-empty">No one has perfect attendance yet.</div>';
      }

      const tableWrap = document.getElementById('attendanceByAthlete');
      if (tableWrap) {
        const rows = s.perAthlete.slice().sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1) || (a.name || '').localeCompare(b.name || ''));
        tableWrap.innerHTML = rows.length
          ? `<table class="attendance-table"><thead><tr><th>Athlete</th><th>Present</th><th>Absent</th><th>Percent</th></tr></thead><tbody>${rows.map(a => `<tr><td>${esc(a.name)}</td><td>${a.present}</td><td>${a.absent}</td><td>${a.percent === null ? '—' : a.percent + '%'}</td></tr>`).join('')}</tbody></table>`
          : '<div class="attendance-empty">No athletes on the roster yet.</div>';
      }
    }

    function renderSummary() {
      const roster = loadRoster().filter(a => a.active !== false);
      const wrap = q('attendanceSummary');
      if (!wrap) return;
      if (!roster.length) {
        wrap.innerHTML = '<div class="attendance-empty">No athletes yet. Take attendance to build your roster.</div>';
        return;
      }
      const date = currentPracticeDate();
      const taken = isAttendanceDoneForDate(date);
      wrap.innerHTML = `<div class="attendance-stat-row"><span>Athletes on roster</span><strong>${roster.length}</strong></div>
        <div class="attendance-stat-row"><span>${esc(formatDate(date))}</span><strong>${taken ? 'Attendance taken' : 'Not taken yet'}</strong></div>`;
    }
    renderSummary();
    renderAlert();
    renderCoachReminder();
    installDataCard();
    renderDataCard();

    const backdrop = document.createElement('div');
    backdrop.id = 'attendanceBackdrop';
    backdrop.className = 'modal-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.innerHTML = `<section aria-label="Take Attendance" aria-modal="true" class="block-modal attendance-modal" role="dialog">
      <h2>Take Attendance</h2>
      <label class="field">Practice date<input id="attendanceDate" type="date"></label>
      <div class="attendance-add-row">
        <input id="attendanceNewName" maxlength="60" placeholder="Add athlete name" type="text">
        <button class="secondary" id="attendanceAddBtn" type="button">Add</button>
      </div>
      <div class="attendance-list" id="attendanceList"></div>
      <div class="brand-modal-actions">
        <button class="secondary" id="attendanceCancelBtn" type="button">Cancel</button>
        <button class="primary" id="attendanceSaveBtn" type="button">Save Attendance</button>
      </div>
    </section>`;
    document.querySelector('.app')?.appendChild(backdrop);

    let draftStatuses = {};

    function loadDraftForDate(date) {
      const attendance = loadAttendance();
      const existing = attendance[date];
      if (existing) return { ...existing };
      const roster = loadRoster().filter(a => a.active !== false);
      const draft = {};
      roster.forEach(a => { draft[a.id] = 'present'; });
      return draft;
    }

    function renderList() {
      const roster = loadRoster().filter(a => a.active !== false).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const wrap = q('attendanceList');
      if (!wrap) return;
      wrap.innerHTML = roster.length ? roster.map(a => {
        const status = draftStatuses[a.id] || '';
        return `<div class="attendance-row" data-id="${esc(a.id)}">
          <span class="attendance-name">${esc(a.name)}</span>
          <div class="attendance-toggle">
            <button class="attendance-btn present-btn${status === 'present' ? ' active' : ''}" data-id="${esc(a.id)}" data-status="present" type="button">Present</button>
            <button class="attendance-btn absent-btn${status === 'absent' ? ' active' : ''}" data-id="${esc(a.id)}" data-status="absent" type="button">Absent</button>
            <button class="attendance-remove-btn" data-id="${esc(a.id)}" title="Remove from roster" type="button">✕</button>
          </div>
        </div>`;
      }).join('') : '<div class="attendance-empty">No athletes on the roster yet. Add one above.</div>';

      wrap.querySelectorAll('.attendance-btn').forEach(btn => btn.addEventListener('click', () => {
        draftStatuses[btn.dataset.id] = btn.dataset.status;
        renderList();
      }));
      wrap.querySelectorAll('.attendance-remove-btn').forEach(btn => btn.addEventListener('click', () => {
        if (!confirm('Remove this athlete from the roster? Past attendance history is kept.')) return;
        const roster = loadRoster();
        const idx = roster.findIndex(a => a.id === btn.dataset.id);
        if (idx >= 0) { roster[idx].active = false; saveRoster(roster); }
        delete draftStatuses[btn.dataset.id];
        renderList();
        renderSummary();
        renderDataCard();
      }));
    }

    function openModal(date) {
      const dateInput = q('attendanceDate');
      dateInput.value = date || dateInput.value || currentPracticeDate();
      draftStatuses = loadDraftForDate(dateInput.value);
      renderList();
      backdrop.classList.add('open');
      backdrop.setAttribute('aria-hidden', 'false');
    }
    function closeModal() {
      backdrop.classList.remove('open');
      backdrop.setAttribute('aria-hidden', 'true');
    }

    q('takeAttendanceBtn').addEventListener('click', () => openModal(currentPracticeDate()));
    if (q('coachAttendanceBtn')) q('coachAttendanceBtn').addEventListener('click', () => openModal(currentPracticeDate()));
    q('attendanceCancelBtn').addEventListener('click', closeModal);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
    q('attendanceDate').addEventListener('change', () => {
      draftStatuses = loadDraftForDate(q('attendanceDate').value || todayStr());
      renderList();
    });

    q('attendanceAddBtn').addEventListener('click', () => {
      const input = q('attendanceNewName');
      const name = (input.value || '').trim();
      if (!name) return;
      const roster = loadRoster();
      const id = 'ath-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      roster.push({ id, name, active: true, addedAt: new Date().toISOString() });
      saveRoster(roster);
      draftStatuses[id] = 'present';
      input.value = '';
      renderList();
    });
    q('attendanceNewName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); q('attendanceAddBtn').click(); } });

    q('attendanceSaveBtn').addEventListener('click', () => {
      const date = q('attendanceDate').value || todayStr();
      const attendance = loadAttendance();
      attendance[date] = { ...draftStatuses };
      saveAttendance(attendance);
      renderSummary();
      renderAlert();
      renderCoachReminder();
      renderDataCard();
      closeModal();
    });

    setInterval(() => { renderAlert(); renderCoachReminder(); }, 1500);

    return true;
  }

  const boot = () => start();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  let attendanceAttempts = 0;
  const attendanceRetry = setInterval(() => {
    attendanceAttempts++;
    if (start() || attendanceAttempts > 20) clearInterval(attendanceRetry);
  }, 150);
})();

/* ===== Last Practice quick view (Practice Builder) ===== */
(() => {
  function sortedArchives() {
    return [...(state.archives || [])].sort((a, b) => new Date(b.archivedAt || b.date || 0) - new Date(a.archivedAt || a.date || 0));
  }

  function archivePracticeHtml(a) {
    if (!a) return '<div class="empty-library">No archived practices yet.</div>';
    const minutes = a.plannedMinutes ?? a.totalMinutes ?? (a.blocks || []).reduce((s, b) => s + (Number(b.minutes) || 0), 0);
    return `<div class="archive-title">${esc(archiveDateLabel(a))}</div>
      <div class="archive-meta">${minutes} min · ${(a.blocks || []).length} blocks</div>
      <div class="archive-goal"><strong>Goal:</strong> ${esc(a.goal || 'No goal entered')}</div>
      ${a.overallCoachNotes ? `<div class="archive-overall"><strong>Overall Practice Notes</strong><br>${esc(a.overallCoachNotes)}</div>` : ''}
      ${(a.blocks || []).map((b, i) => `<div class="archive-block"><div class="archive-block-title">${i + 1}. ${esc(b.name)}</div><div class="archive-block-meta">${esc(categoryInfo(b.category).label)} · ${b.minutes} min</div>${b.details ? `<div class="archive-note"><strong>Plan:</strong> ${esc(b.details)}</div>` : ''}${b.coachNotes ? `<div class="archive-note"><strong>Practice notes:</strong> ${esc(b.coachNotes)}</div>` : ''}</div>`).join('')}`;
  }

  function start() {
    const builder = document.getElementById('builderPage');
    if (!builder || document.getElementById('viewLastPracticeBtn')) return false;

    const btn = document.createElement('button');
    btn.id = 'viewLastPracticeBtn';
    btn.type = 'button';
    btn.className = 'secondary last-practice-btn';
    btn.textContent = 'View Last Practice';
    const addBtn = document.getElementById('addBtn');
    if (addBtn) addBtn.after(btn); else builder.prepend(btn);

    const panel = document.createElement('div');
    panel.id = 'lastPracticePanel';
    panel.className = 'last-practice-panel';
    panel.hidden = true;
    panel.innerHTML = `<div class="last-practice-head">
        <button class="secondary last-practice-nav" id="lastPracticeOlderBtn" title="Older practice" type="button">◀</button>
        <div class="last-practice-title-wrap"><h3 id="lastPracticeTitle">Last Practice</h3><span class="last-practice-position" id="lastPracticePosition"></span></div>
        <button class="secondary last-practice-nav" id="lastPracticeNewerBtn" title="Newer practice" type="button">▶</button>
        <button class="secondary" id="lastPracticeCloseBtn" type="button">Close</button>
      </div>
      <div class="last-practice-body" id="lastPracticeBody"></div>`;
    document.querySelector('.app')?.appendChild(panel);

    let index = 0;

    function renderCurrent() {
      const list = sortedArchives();
      if (!list.length) {
        document.getElementById('lastPracticeTitle').textContent = 'Last Practice';
        document.getElementById('lastPracticePosition').textContent = '';
        document.getElementById('lastPracticeBody').innerHTML = archivePracticeHtml(null);
        document.getElementById('lastPracticeOlderBtn').disabled = true;
        document.getElementById('lastPracticeNewerBtn').disabled = true;
        return;
      }
      index = Math.max(0, Math.min(index, list.length - 1));
      const a = list[index];
      document.getElementById('lastPracticeTitle').textContent = archiveDateLabel(a);
      document.getElementById('lastPracticePosition').textContent = `${index + 1} of ${list.length}`;
      document.getElementById('lastPracticeBody').innerHTML = archivePracticeHtml(a);
      document.getElementById('lastPracticeOlderBtn').disabled = index >= list.length - 1;
      document.getElementById('lastPracticeNewerBtn').disabled = index <= 0;
    }
    function goOlder() { index++; renderCurrent(); }
    function goNewer() { index--; renderCurrent(); }

    function openPanel() { index = 0; renderCurrent(); panel.hidden = false; }
    function closePanel() { panel.hidden = true; }
    function toggle() { panel.hidden ? openPanel() : closePanel(); }

    btn.addEventListener('click', toggle);
    document.getElementById('lastPracticeCloseBtn')?.addEventListener('click', closePanel);
    document.getElementById('lastPracticeOlderBtn')?.addEventListener('click', goOlder);
    document.getElementById('lastPracticeNewerBtn')?.addEventListener('click', goNewer);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) closePanel(); });

    function isTypingTarget(target) {
      if (!target) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (tag === 'INPUT') {
        const type = (target.type || 'text').toLowerCase();
        return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file'].includes(type);
      }
      return false;
    }
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (e.key === 'd' || e.key === 'D') { if (e.repeat) return; e.preventDefault(); toggle(); return; }
      if (panel.hidden) return;
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); goOlder(); return; }
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); goNewer(); return; }
    });

    return true;
  }

  const boot = () => start();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  let lastPracticeAttempts = 0;
  const lastPracticeRetry = setInterval(() => {
    lastPracticeAttempts++;
    if (start() || lastPracticeAttempts > 20) clearInterval(lastPracticeRetry);
  }, 150);
})();

/* ===== Seed: "12 Days of Christmas" practice template ===== */
(() => {
  const KEY = 'wpp-practice-templates';
  const TEMPLATE_NAME = '12 Days of Christmas';
  let list;
  try { list = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { list = []; }
  if (!Array.isArray(list)) list = [];
  if (list.some(t => t && t.name === TEMPLATE_NAME)) return;

  const exercises = [
    'Run to the drinking fountain at the far end of the room and back',
    'Dummy Headlocks',
    'Back pedal (3 mat lengths)',
    'Box jumps',
    'Overhead bag circles (5 each side for 10 total)',
    'Sprawls and circle up',
    'Sit Stands',
    'Burpees (chest to ground and jump at the top)',
    'Russian Twists (9 each direction for 18 total)',
    'Bag Slams',
    'Frog Jumps (as far as you can)',
    'Rope Pulls (1 full loop = one rep)'
  ];

  const LADDER_NOTE = 'Ladder workout: on "1," do exercise 1. On "2," do exercise 2, then circle back for exercise 1. Keep adding one new exercise per number until all 12 are done in order, then work back down to 1 — just like the song. Wrestlers race the clock through the whole ladder; their time is their score.';

  const blocks = exercises.map((name, i) => ({
    name: (i + 1) + '. ' + name,
    minutes: 2,
    details: i === 0 ? LADDER_NOTE : '',
    category: 'conditioning'
  }));

  const template = {
    id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()),
    name: TEMPLATE_NAME,
    goal: 'Team conditioning tradition — race the ladder for time.',
    length: blocks.reduce((sum, b) => sum + (Number(b.minutes) || 0), 0),
    blocks,
    createdAt: new Date().toISOString()
  };

  list.unshift(template);
  localStorage.setItem(KEY, JSON.stringify(list));
})();
