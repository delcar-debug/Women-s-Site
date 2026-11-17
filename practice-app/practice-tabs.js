/* Practice tabs: build several practice days at once.
   - The ACTIVE tab is always the normal working plan ('wpp-v2'), so the timer, TV view,
     sharing and everything else keep working exactly as before.
   - All tabs are kept in 'wpp-drafts' (synced to the cloud like the other data).
   - Archiving a practice removes its tab. */
(() => {
  const KEY = 'wpp-drafts';
  const PLAN = 'wpp-v2';
  let drafts = null;
  let loadedActive = null;   // which tab's plan is currently loaded into the builder

  const read = () => {
    try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return d && typeof d === 'object' && d.plans && Array.isArray(d.order) ? d : null; }
    catch { return null; }
  };
  const write = d => { drafts = d; localStorage.setItem(KEY, JSON.stringify(d)); };
  const uid = () => 'tab-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = s => { try { return JSON.parse(s || '{}') || {}; } catch { return {}; } };

  function blankPlan(date) {
    return JSON.stringify({
      blocks: [], date, start: '15:30', length: '90', goal: '', journal: '', journalEnd: '', type: '',
      rating: '', cultureRating: '', work: '30', rest: '10', rounds: '6',
      coachEmails: (typeof state !== 'undefined' && state.coachEmails) || [], overallCoachNotes: ''
    });
  }
  function nextFreeDate() {
    const used = new Set(drafts.order.map(id => parse(drafts.plans[id]).date).filter(Boolean));
    const d = new Date(); d.setHours(12, 0, 0, 0);
    for (let i = 1; i < 60; i++) {
      const c = new Date(d.getTime() + i * 86400000);
      if (!used.has(ymd(c))) return ymd(c);
    }
    return '';
  }
  function labelFor(planStr) {
    const p = parse(planStr);
    if (!p.date) return 'New practice';
    const d = new Date(p.date + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return 'New practice';
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  const practiceRunning = () => !!(typeof state !== 'undefined' && state.practiceActive);

  function init() {
    drafts = read();
    const cur = localStorage.getItem(PLAN);
    if (!drafts || !drafts.order.length || !drafts.plans[drafts.active]) {
      const id = uid();
      write({ v: 1, active: id, order: [id], plans: { [id]: cur || blankPlan('') } });
    } else if (cur && drafts.plans[drafts.active] !== cur) {
      // The working plan is the source of truth for the active tab.
      drafts.plans[drafts.active] = cur;
      write(drafts);
    }
    loadedActive = drafts.active;
    renderBar();
  }

  // Keep the active tab's stored copy in step with the working plan.
  function mirror() {
    if (!drafts || loadedActive !== drafts.active) return;
    const cur = localStorage.getItem(PLAN);
    if (cur && drafts.plans[drafts.active] !== cur) {
      drafts.plans[drafts.active] = cur;
      write(drafts);
    }
    renderBar();
  }

  function applyPlan(planStr) {
    localStorage.setItem(PLAN, planStr);
    try { state.autoArchiveKey = null; } catch (e) {}
    loadedActive = drafts.active;
    try { window.load(); window.render(); } catch (e) { console.warn('Tab switch render failed', e); }
    renderBar();
  }

  function switchTo(id) {
    if (!drafts || id === drafts.active || !drafts.plans[id]) return;
    if (practiceRunning()) { alert('A practice is running in Coach Mode. Finish or stop it before switching tabs.'); return; }
    try { window.save(); } catch (e) {}
    mirror();
    drafts.active = id;
    write(drafts);
    applyPlan(drafts.plans[id]);
  }

  function newTab() {
    if (practiceRunning()) { alert('A practice is running in Coach Mode. Finish or stop it before adding a tab.'); return; }
    try { window.save(); } catch (e) {}
    mirror();
    const id = uid();
    drafts.plans[id] = blankPlan(nextFreeDate());
    drafts.order.push(id);
    drafts.active = id;
    write(drafts);
    applyPlan(drafts.plans[id]);
  }

  function removeTab(id) {
    const i = drafts.order.indexOf(id);
    if (i < 0) return;
    drafts.order.splice(i, 1);
    delete drafts.plans[id];
    if (!drafts.order.length) {
      const nid = uid();
      drafts.plans[nid] = blankPlan(nextFreeDate());
      drafts.order.push(nid);
      drafts.active = nid;
      write(drafts);
      applyPlan(drafts.plans[nid]);
      return;
    }
    if (drafts.active === id) {
      drafts.active = drafts.order[Math.min(i, drafts.order.length - 1)];
      write(drafts);
      applyPlan(drafts.plans[drafts.active]);
    } else {
      write(drafts);
      renderBar();
    }
  }

  function closeTab(id) {
    if (practiceRunning() && id === drafts.active) { alert('A practice is running in Coach Mode. Finish or stop it first.'); return; }
    const name = labelFor(drafts.plans[id]);
    if (!confirm('Close the "' + name + '" tab and delete its plan?\n\nPractices already in the Archive are not affected.')) return;
    if (id === drafts.active) { try { window.save(); } catch (e) {} }
    removeTab(id);
  }

  // Called by app.js after a practice is archived: that practice's tab is done.
  window.onPracticeArchived = function () {
    if (!drafts) return;
    removeTab(drafts.active);
  };

  // Called when tabs arrive from the cloud (another device) or after the first cloud download.
  window.renderPracticeTabs = function () {
    const r = read();
    if (!r) return;
    drafts = r;
    if (loadedActive !== drafts.active && drafts.plans[drafts.active] && !practiceRunning()) applyPlan(drafts.plans[drafts.active]);
    else renderBar();
  };
  window.initPracticeTabs = init;

  function renderBar() {
    let bar = document.getElementById('practiceTabs');
    if (!bar) {
      const h = [...document.querySelectorAll('h2')].find(x => x.textContent.trim() === 'Build Practice');
      const card = h && h.closest('section');
      if (!card) return;
      bar = document.createElement('div');
      bar.id = 'practiceTabs';
      bar.className = 'practice-tabs';
      card.parentNode.insertBefore(bar, card);
      bar.addEventListener('click', ev => {
        const x = ev.target.closest('[data-close]');
        if (x) { ev.stopPropagation(); closeTab(x.dataset.close); return; }
        if (ev.target.closest('#practiceTabAdd')) { newTab(); return; }
        const t = ev.target.closest('[data-tab]');
        if (t) switchTo(t.dataset.tab);
      });
    }
    if (!drafts) return;
    const running = practiceRunning();
    const html = drafts.order.map(id => {
      const active = id === drafts.active;
      const n = (parse(drafts.plans[id]).blocks || []).length;
      return '<button type="button" class="ptab' + (active ? ' active' : '') + (running && !active ? ' disabled' : '') + '" data-tab="' + id + '">' +
        '<span class="ptab-label">' + labelFor(drafts.plans[id]) + '</span>' +
        '<span class="ptab-count">' + n + (n === 1 ? ' block' : ' blocks') + '</span>' +
        '<span class="ptab-x" data-close="' + id + '" title="Close tab">×</span></button>';
    }).join('') + '<button type="button" class="ptab-add" id="practiceTabAdd" title="Add a practice day">+ Add practice day</button>';
    if (bar.dataset.html !== html) { bar.innerHTML = html; bar.dataset.html = html; }
  }

  // Wrap save() so every change is mirrored into the active tab.
  const origSave = window.save;
  if (typeof origSave === 'function') {
    window.save = function (...args) {
      const r = origSave.apply(this, args);
      try { mirror(); } catch (e) {}
      return r;
    };
  }

  init();
  setInterval(() => { if (drafts) renderBar(); }, 3000);   // keeps labels/disabled state fresh
})();
