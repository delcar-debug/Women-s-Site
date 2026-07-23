// nav-fix-script

(()=>{
  const $=id=>document.getElementById(id);
  const pageIds=['builderPage','libraryPage','practiceDataPage','practiceQueuePage','drillLibraryPage','teamBoardPage'];
  const navIds=['navBuilder','navCoach','navTeam','navLibrary','navData','navQueue','navDrills'];
  function hideStandard(){
    $('builderPage')?.classList.add('hidden-page');
    $('libraryPage')?.classList.remove('active');
    $('practiceDataPage')?.classList.remove('active');
    $('practiceQueuePage')?.classList.remove('active');
    $('drillLibraryPage')?.classList.remove('active');
    $('teamBoardPage')?.classList.remove('active');
    $('timerPanel')?.classList.remove('active');
    document.body.classList.remove('coach-mode-open');
    navIds.forEach(id=>$(id)?.classList.remove('active'));
  }
  function openSpecial(which){
    hideStandard();
    const page=which==='queue'?$('practiceQueuePage'):$('drillLibraryPage');
    const nav=which==='queue'?$('navQueue'):$('navDrills');
    page?.classList.add('active');
    nav?.classList.add('active');
    try{ which==='queue'?window.renderQueue?.():window.renderDrillLibrary?.(); }catch(e){console.error(e)}
    window.scrollTo({top:0});
  }
  const q=$('navQueue'),d=$('navDrills');
  if(q){q.textContent='Practice Queue';q.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openSpecial('queue')},true)}
  if(d){d.textContent='Library';d.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openSpecial('drills')},true)}
  if($('navLibrary')) $('navLibrary').textContent='Archive';
  if($('navData')) $('navData').textContent='Data';
})();


// stability-fixes-script

(()=>{
  const byId=id=>document.getElementById(id);
  const safeJson=(raw)=>{try{return JSON.parse(raw)}catch{return null}};
  const asArray=(value)=>Array.isArray(value)?value:(Array.isArray(value?.archives)?value.archives:[]);
  const archiveKeys=['wpp-practice-library','wpp-archives','wpp-practice-archives','practiceArchives'];
  const normalizeArchive=(a,index)=>{
    if(!a||typeof a!=='object')return null;
    const blocks=Array.isArray(a.blocks)?a.blocks.map((b,i)=>({
      id:b?.id||`arch-${index}-${i}`,
      name:String(b?.name||b?.activity||`Block ${i+1}`),
      minutes:Math.max(0,Number(b?.minutes??b?.duration??0)||0),
      details:String(b?.details||b?.notes||''),
      category:b?.category||'other',
      coachNotes:String(b?.coachNotes||b?.practiceNotes||'')
    })):[];
    const planned=Number(a.plannedMinutes??a.totalMinutes??a.length);
    return {
      ...a,
      id:String(a.id||`archive-${a.archivedAt||a.date||Date.now()}-${index}`),
      archivedAt:a.archivedAt||a.createdAt||new Date().toISOString(),
      date:a.date||a.practiceDate||a.plannedDate||'',
      goal:a.goal||a.practiceGoal||'',
      start:a.start||a.startTime||'15:30',
      blocks,
      plannedMinutes:Number.isFinite(planned)?planned:blocks.reduce((n,b)=>n+b.minutes,0),
      totalMinutes:Number.isFinite(Number(a.totalMinutes))?Number(a.totalMinutes):blocks.reduce((n,b)=>n+b.minutes,0),
      overallCoachNotes:String(a.overallCoachNotes||a.overallNotes||'')
    };
  };
  function loadMergedArchives(){
    const merged=[],seen=new Set();
    for(const key of archiveKeys){
      const raw=localStorage.getItem(key); if(!raw)continue;
      for(const item of asArray(safeJson(raw))){
        const a=normalizeArchive(item,merged.length); if(!a)continue;
        const fingerprint=a.id||`${a.date}|${a.archivedAt}|${a.goal}|${a.blocks.length}`;
        if(seen.has(fingerprint))continue;
        seen.add(fingerprint);merged.push(a);
      }
    }
    merged.sort((a,b)=>new Date(b.date||b.archivedAt||0)-new Date(a.date||a.archivedAt||0));
    if(window.state)state.archives=merged;
    localStorage.setItem('wpp-practice-library',JSON.stringify(merged));
    return merged;
  }
  window.reloadPracticeArchives=loadMergedArchives;

  function refreshArchive(){
    loadMergedArchives();
    try{window.renderLibrary?.()}catch(err){
      console.error('Archive render failed',err);
      const list=byId('libraryList');
      if(list){
        const items=window.state?.archives||[];
        list.innerHTML=items.length?items.map(a=>`<article class="archive-card"><div class="archive-title">${window.esc?esc(window.archiveDateLabel?archiveDateLabel(a):(a.date||'Archived practice')):(a.date||'Archived practice')}</div><div class="archive-meta">${a.plannedMinutes||0} min · ${(a.blocks||[]).length} blocks</div></article>`).join(''):'<div class="empty-library">No archived practices found on this device.</div>';
      }
    }
  }

  const archiveNav=byId('navLibrary');
  archiveNav?.addEventListener('click',()=>setTimeout(refreshArchive,0),true);

  // Keep archives in memory when another tab/window writes them.
  window.addEventListener('storage',e=>{if(archiveKeys.includes(e.key)){loadMergedArchives();if(byId('libraryPage')?.classList.contains('active'))refreshArchive()}});

  // Move the shortcut legend to body so it cannot be clipped by Coach Mode panels.
  const legend=byId('coachShortcutKey');
  if(legend&&legend.parentElement!==document.body)document.body.appendChild(legend);
  const coachPanel=byId('timerPanel');
  const syncLegend=()=>document.body.classList.toggle('coach-mode-open',!!coachPanel?.classList.contains('active'));
  syncLegend();
  coachPanel&&new MutationObserver(syncLegend).observe(coachPanel,{attributes:true,attributeFilter:['class']});

  // Browser timer IDs cannot survive reloads. Always reset the interval engine to a valid idle state.
  function initializeIntervalEngine(){
    const t=window.state?.interval;if(!t)return;
    try{clearInterval(t.timerId)}catch{}
    t.timerId=null;t.running=false;
    if(!['ready','work','rest','complete'].includes(t.phase))t.phase='ready';
    if(t.phase!=='ready')t.phase='ready';
    try{window.resetInterval?.()}catch{}
  }
  initializeIntervalEngine();

  const isTyping=t=>!!t&&(t.matches?.('textarea,[contenteditable="true"]')||t.closest?.('[contenteditable="true"]')||
    (t.matches?.('input')&&['text','search','email','url','tel','password'].includes((t.type||'text').toLowerCase())));
  // Capture S before older handlers. This gives the first key press the exact same path as the button.
  document.addEventListener('keydown',e=>{
    if((e.key||'').toLowerCase()!=='s'||!coachPanel?.classList.contains('active')||isTyping(e.target))return;
    e.preventDefault();e.stopImmediatePropagation();
    const t=window.state?.interval;if(!t)return;
    if(t.running){t.running=false;try{window.renderInterval?.();window.saveLiveState?.()}catch{};return;}
    try{clearInterval(t.timerId)}catch{};t.timerId=null;
    if(t.phase==='complete')t.phase='ready';
    if(typeof window.startInterval==='function')window.startInterval();
    else byId('intervalStartBtn')?.click();
  },true);

  // Initial archive merge after all original scripts have initialized state.
  setTimeout(loadMergedArchives,0);
})();


// next-practice-notes-script

(()=>{
  const KEY='wpp-next-practice-notes-v1';
  const read=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch{return []}};
  let notes=read();
  const save=()=>{localStorage.setItem(KEY,JSON.stringify(notes));renderAll();};
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function listMarkup(){
    if(!notes.length)return '<div class="next-notes-empty">No next-practice notes yet.</div>';
    return notes.map(n=>`<div class="next-note-item" data-next-note-id="${escapeHtml(n.id)}"><div class="next-note-text">${escapeHtml(n.text)}</div><button class="danger next-note-delete" type="button" data-delete-next-note="${escapeHtml(n.id)}">Delete</button></div>`).join('');
  }
  function renderAll(){
    const html=listMarkup();
    ['nextPracticeNotesBuilderList','nextPracticeNotesCoachList'].forEach(id=>{const node=document.getElementById(id);if(node)node.innerHTML=html;});
  }
  function add(){
    const input=document.getElementById('nextPracticeNoteInput');
    const text=(input?.value||'').trim();
    if(!text)return;
    notes.push({id:(crypto.randomUUID?.()||String(Date.now())+Math.random()),text,createdAt:new Date().toISOString()});
    input.value='';save();input.focus();
  }
  document.addEventListener('click',event=>{
    const del=event.target.closest('[data-delete-next-note]');
    if(del){notes=notes.filter(n=>n.id!==del.dataset.deleteNextNote);save();return;}
    if(event.target.id==='addNextPracticeNote'){add();return;}
    if(event.target.id==='clearAllNextNotes'&&notes.length&&confirm('Delete all Next Practice Notes?')){notes=[];save();}
  });
  document.addEventListener('keydown',event=>{
    if(event.target?.id==='nextPracticeNoteInput'&&event.key==='Enter'){event.preventDefault();add();}
  });
  window.addEventListener('storage',event=>{if(event.key===KEY){notes=read();renderAll();}});
  const removeLegend=()=>document.getElementById('coachShortcutKey')?.remove();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{removeLegend();renderAll();});else{removeLegend();renderAll();}
})();


// builder-coach-inbox-script

(()=>{
  const QUEUE_KEY='wpp-practice-queue';
  const NOTES_KEY='wpp-next-practice-notes-v1';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const readQueue=()=>{try{const v=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return []}};
  const writeQueue=q=>{
    localStorage.setItem(QUEUE_KEY,JSON.stringify(q));
    try{window.loadCoachKnowledge?.()}catch(e){console.error(e)}
    renderBuilderQueue();
  };
  function ensureLayout(){
    const notes=document.getElementById('nextPracticeNotesBuilder');
    if(!notes||document.getElementById('builderPlanningInbox'))return;
    const wrap=document.createElement('div');wrap.id='builderPlanningInbox';wrap.className='builder-planning-inbox';
    notes.parentNode.insertBefore(wrap,notes);wrap.appendChild(notes);
    const queue=document.createElement('section');queue.id='builderQueueInbox';queue.className='builder-queue-inbox';
    queue.innerHTML='<div class="builder-queue-inbox-head"><h2>Practice Queue</h2><span id="builderQueueCount" class="builder-queue-count"></span></div><div id="builderQueueList" class="builder-queue-list"></div><button id="openFullQueueBtn" class="secondary builder-queue-more" type="button">Open full queue</button>';
    wrap.appendChild(queue);
  }
  function renderBuilderQueue(){
    ensureLayout();
    const list=document.getElementById('builderQueueList'),count=document.getElementById('builderQueueCount');if(!list)return;
    const queue=readQueue();if(count)count.textContent=`${queue.length} item${queue.length===1?'':'s'}`;
    const shown=queue.slice(0,6);
    list.innerHTML=shown.length?shown.map(q=>`<article class="builder-queue-item" data-builder-queue-id="${esc(q.id)}"><div class="builder-queue-title">${esc(q.title||'Untitled item')}</div><div class="builder-queue-meta">Added by ${esc(q.addedBy||q.athlete||'Coach')}</div><div class="builder-queue-actions"><button class="secondary" data-queue-to-note="${esc(q.id)}" type="button">To notes</button><button class="primary" data-queue-to-block="${esc(q.id)}" type="button">Make block</button><button class="secondary" data-queue-to-drill="${esc(q.id)}" type="button">Save drill</button><button class="danger" data-queue-addressed="${esc(q.id)}" type="button">Addressed</button></div></article>`).join(''):'<div class="builder-queue-empty">No items in the practice queue.</div>';
  }
  function addToNextNotes(id){
    const item=readQueue().find(q=>q.id===id);if(!item)return;
    let notes=[];try{notes=JSON.parse(localStorage.getItem(NOTES_KEY)||'[]');if(!Array.isArray(notes))notes=[]}catch{}
    if(!notes.some(n=>String(n.text||'').trim().toLowerCase()===String(item.title||'').trim().toLowerCase())){
      notes.push({id:crypto.randomUUID?.()||String(Date.now()),text:item.title,createdAt:new Date().toISOString()});
      localStorage.setItem(NOTES_KEY,JSON.stringify(notes));
      window.dispatchEvent(new StorageEvent('storage',{key:NOTES_KEY,newValue:JSON.stringify(notes),storageArea:localStorage}));
    }
  }
  document.addEventListener('click',e=>{
    const n=e.target.closest('[data-queue-to-note]');if(n){addToNextNotes(n.dataset.queueToNote);return}
    const b=e.target.closest('[data-queue-to-block]');if(b){try{window.addQueueToPractice?.(b.dataset.queueToBlock)}catch(err){console.error(err)}return}
    const d=e.target.closest('[data-queue-to-drill]');if(d){try{window.saveQueueAsDrill?.(d.dataset.queueToDrill)}catch(err){console.error(err)}return}
    const a=e.target.closest('[data-queue-addressed]');if(a){writeQueue(readQueue().filter(q=>q.id!==a.dataset.queueAddressed));return}
    if(e.target.closest('#openFullQueueBtn')){try{window.showAppPage?.('queue')}catch(err){document.getElementById('navQueue')?.click()}return}
  });
  window.addEventListener('storage',e=>{if(e.key===QUEUE_KEY)renderBuilderQueue()});
  const start=()=>{ensureLayout();renderBuilderQueue()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();


// practice-inbox-merge-script

(()=>{
 const QKEY='wpp-practice-queue',NKEY='wpp-next-practice-notes-v1';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const readQ=()=>{try{const v=JSON.parse(localStorage.getItem(QKEY)||'[]');return Array.isArray(v)?v:[]}catch{return []}};
 const writeQ=q=>{localStorage.setItem(QKEY,JSON.stringify(q));render();try{window.loadCoachKnowledge?.()}catch{}};
 function migrate(){let q=readQ(),notes=[];try{notes=JSON.parse(localStorage.getItem(NKEY)||'[]');if(!Array.isArray(notes))notes=[]}catch{};for(const n of notes){const text=String(n.text||'').trim();if(text&&!q.some(x=>String(x.title||'').trim().toLowerCase()===text.toLowerCase()))q.push({id:n.id||crypto.randomUUID?.()||String(Date.now()+Math.random()),title:text,addedBy:'Coach',source:'practice',details:'',createdAt:n.createdAt||new Date().toISOString()})}localStorage.setItem(QKEY,JSON.stringify(q));localStorage.removeItem(NKEY)}
 function panel(id,coach=false){const sec=document.createElement(coach?'details':'section');sec.id=id;sec.className='practice-inbox-panel'+(coach?' coach-inbox-panel':'');const today=new Date().toISOString().slice(0,10);const headTag=coach?'summary':'div';sec.innerHTML=`<${headTag} class="practice-inbox-head"><h2>Inbox</h2><span class="practice-inbox-count"></span></${headTag}><div class="practice-inbox-form"><input class="inbox-work" type="text" placeholder="What should we work on?"><input class="inbox-by" type="text" placeholder="Added by"><label class="inbox-date-field"><span>Date added</span><input class="inbox-date" type="date" value="${today}"></label><button class="primary inbox-add" type="button">Add</button></div><div class="practice-inbox-list"></div>${coach?'':'<button class="secondary inbox-open-full" type="button" style="margin-top:8px;width:100%">Open full inbox</button>'}`;return sec}
 function ensure(){
   document.getElementById('nextPracticeNotesBuilder')?.remove();document.getElementById('nextPracticeNotesCoach')?.remove();document.getElementById('builderPlanningInbox')?.remove();
   const shareActions=document.querySelector('#builderPage .share-actions');if(shareActions&&!document.getElementById('builderPracticeInbox'))shareActions.insertAdjacentElement('afterend',panel('builderPracticeInbox'));
   const timer=document.querySelector('#timerPanel .compact-timer-section');if(timer&&!document.getElementById('coachPracticeInbox'))timer.insertAdjacentElement('afterend',panel('coachPracticeInbox',true));
   const nav=document.getElementById('navQueue');if(nav)nav.textContent='Inbox';
   const qp=document.getElementById('practiceQueuePage');if(qp){
     const legacy=qp.querySelector('.simple-queue-panel');
     if(legacy)legacy.hidden=true;
     if(!document.getElementById('fullPracticeInbox'))qp.appendChild(panel('fullPracticeInbox'));
   }
 }
 function dateAddedLabel(q){const raw=q.dateAdded||(q.createdAt?q.createdAt.slice(0,10):'');if(!raw)return '';const d=new Date(raw+'T12:00:00');return Number.isNaN(d.getTime())?'':d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}
 function daysStale(q){const raw=q.dateAdded||(q.createdAt?q.createdAt.slice(0,10):'');if(!raw)return 0;const d=new Date(raw+'T12:00:00');if(Number.isNaN(d.getTime()))return 0;return Math.max(0,Math.floor((Date.now()-d.getTime())/86400000))}
 function itemHtml(q){const dl=dateAddedLabel(q);const stale=daysStale(q);const isStale=stale>=3;return `<article class="practice-inbox-item${isStale?' is-stale':''}"><div class="practice-inbox-title">${esc(q.title||'Untitled item')}${isStale?`<span class="practice-inbox-stale-badge" title="Sitting in the inbox for ${stale} days">${stale}d old</span>`:''}</div><div class="practice-inbox-meta">Added by ${esc(q.addedBy||q.athlete||'Coach')}${dl?' · '+esc(dl):''}</div><div class="practice-inbox-actions"><button class="primary" data-inbox-block="${esc(q.id)}" type="button">Add to practice</button><button class="secondary" data-inbox-drill="${esc(q.id)}" type="button">Save drill</button><button class="danger" data-inbox-done="${esc(q.id)}" type="button">Done</button></div></article>`}
 function render(){ensure();const q=readQ();document.querySelectorAll('.practice-inbox-panel').forEach(sec=>{sec.querySelector('.practice-inbox-count').textContent=`${q.length} item${q.length===1?'':'s'}`;const list=sec.querySelector('.practice-inbox-list');const shown=sec.id==='coachPracticeInbox'?q.slice(0,4):(sec.id==='builderPracticeInbox'?q.slice(0,6):q);list.innerHTML=shown.length?shown.map(itemHtml).join(''):'<div class="practice-inbox-empty">No items in the inbox.</div>'})}
 function add(sec){const work=sec.querySelector('.inbox-work'),by=sec.querySelector('.inbox-by'),dateEl=sec.querySelector('.inbox-date');const title=work.value.trim(),addedBy=by.value.trim();const dateAdded=dateEl?.value||new Date().toISOString().slice(0,10);if(!title||!addedBy){alert('Enter both what to work on and who added it.');return}const q=readQ();q.unshift({id:crypto.randomUUID?.()||String(Date.now()),title,addedBy,dateAdded,source:'coach',details:'',createdAt:new Date().toISOString()});writeQ(q);work.value='';work.focus();if(dateEl)dateEl.value=new Date().toISOString().slice(0,10)}
 document.addEventListener('click',e=>{const sec=e.target.closest('.practice-inbox-panel');if(e.target.closest('.inbox-add')&&sec){add(sec);return}const done=e.target.closest('[data-inbox-done]');if(done){writeQ(readQ().filter(q=>String(q.id)!==done.dataset.inboxDone));return}const block=e.target.closest('[data-inbox-block]');if(block){try{addQueueToPractice(block.dataset.inboxBlock)}catch(err){console.error(err)}return}const drill=e.target.closest('[data-inbox-drill]');if(drill){try{saveQueueAsDrill(drill.dataset.inboxDrill)}catch(err){console.error(err)}return}if(e.target.closest('.inbox-open-full')){document.getElementById('navQueue')?.click()}});
 document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('.inbox-work,.inbox-by')){e.preventDefault();const sec=e.target.closest('.practice-inbox-panel');if(sec)add(sec)}});
 window.addEventListener('storage',e=>{if(e.key===QKEY)render()});
 const start=()=>{migrate();ensure();render()};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();


// practice inbox completed archive

(()=>{
  const ACTIVE_KEY='wpp-practice-queue';
  const ARCHIVE_KEY='wpp-practice-inbox-archive-v1';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=(key)=>{try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch{return []}};
  const write=(key,v)=>localStorage.setItem(key,JSON.stringify(v));

  function archiveShell(panel){
    if(panel.querySelector('.practice-inbox-archive'))return;
    const d=document.createElement('details');
    d.className='practice-inbox-archive';
    if(panel.id==='fullPracticeInbox')d.open=true;
    d.innerHTML='<summary><span>Completed Inbox Items</span><span class="practice-inbox-archive-count"></span></summary><div class="practice-inbox-archive-list"></div>';
    panel.appendChild(d);
  }
  function archiveHtml(item){
    const when=item.completedAt?new Date(item.completedAt).toLocaleDateString():'';
    return `<article class="practice-inbox-archive-item"><div class="practice-inbox-title">${esc(item.title||'Untitled item')}</div><div class="practice-inbox-meta">Added by ${esc(item.addedBy||'Coach')}${when?' · Completed '+esc(when):''}</div><div class="practice-inbox-archive-actions"><button class="secondary" data-inbox-restore="${esc(item.id)}" type="button">Restore</button><button class="danger" data-inbox-delete-archived="${esc(item.id)}" type="button">Delete</button></div></article>`;
  }
  function renderArchive(){
    const archived=read(ARCHIVE_KEY);
    document.querySelectorAll('.practice-inbox-panel:not(.coach-inbox-panel)').forEach(panel=>{
      archiveShell(panel);
      const count=panel.querySelector('.practice-inbox-archive-count');
      const list=panel.querySelector('.practice-inbox-archive-list');
      if(count)count.textContent=`${archived.length}`;
      if(list)list.innerHTML=archived.length?archived.map(archiveHtml).join(''):'<div class="practice-inbox-empty">No completed items yet.</div>';
    });
  }
  function moveToArchive(id){
    const active=read(ACTIVE_KEY);const idx=active.findIndex(x=>String(x.id)===String(id));if(idx<0)return;
    const [item]=active.splice(idx,1);const archived=read(ARCHIVE_KEY);
    archived.unshift({...item,completedAt:new Date().toISOString()});write(ACTIVE_KEY,active);write(ARCHIVE_KEY,archived);
    window.dispatchEvent(new StorageEvent('storage',{key:ACTIVE_KEY}));
    renderArchive();
    setTimeout(()=>{try{document.querySelector('.practice-inbox-panel')?.dispatchEvent(new Event('refresh'))}catch{}},0);
    location.hash=location.hash;
  }
  function restore(id){
    const archived=read(ARCHIVE_KEY);const idx=archived.findIndex(x=>String(x.id)===String(id));if(idx<0)return;
    const [item]=archived.splice(idx,1);const active=read(ACTIVE_KEY);active.unshift({...item,completedAt:undefined});write(ARCHIVE_KEY,archived);write(ACTIVE_KEY,active);renderArchive();location.reload();
  }
  function deleteArchived(id){write(ARCHIVE_KEY,read(ARCHIVE_KEY).filter(x=>String(x.id)!==String(id)));renderArchive()}

  document.addEventListener('click',e=>{
    const done=e.target.closest('[data-inbox-done]');
    if(done){e.preventDefault();e.stopImmediatePropagation();moveToArchive(done.dataset.inboxDone);return;}
    const restoreBtn=e.target.closest('[data-inbox-restore]');if(restoreBtn){restore(restoreBtn.dataset.inboxRestore);return;}
    const del=e.target.closest('[data-inbox-delete-archived]');if(del){if(confirm('Delete this archived inbox item?'))deleteArchived(del.dataset.inboxDeleteArchived);return;}
  },true);

  const startArchive=()=>{document.querySelectorAll('.practice-inbox-panel:not(.coach-inbox-panel)').forEach(archiveShell);renderArchive()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startArchive);else startArchive();
  window.addEventListener('storage',e=>{if(e.key===ARCHIVE_KEY||e.key===ACTIVE_KEY)renderArchive()});


})();
