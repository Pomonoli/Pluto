'use strict';

(() => {
  const STORAGE_KEY='pluto.lastSeenVersion';
  const isStandalone=window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (!isStandalone) return;

  function hasChanges(changes) {
    return ['games','features','improvements'].some((key) => Array.isArray(changes?.[key]) && changes[key].length);
  }

  function appendSection(parent, title, items) {
    if (!Array.isArray(items) || !items.length) return;
    const section=document.createElement('section');
    section.className='whats-new-section';
    const heading=document.createElement('h3');
    heading.textContent=title;
    const list=document.createElement('ul');
    for (const item of items) {
      const li=document.createElement('li');
      li.textContent=item;
      list.append(li);
    }
    section.append(heading,list);
    parent.append(section);
  }

  function ensureStyles() {
    if (document.querySelector('link[data-whats-new]')) return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/whats-new.css?v=1.11.2';
    link.dataset.whatsNew='1';
    document.head.append(link);
  }

  async function markSeen(data) {
    if (data.authenticated) {
      try {
        await fetch('/api/updates/seen', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({version:data.currentVersion})
        });
      } catch (_) {}
    } else {
      localStorage.setItem(STORAGE_KEY,data.currentVersion);
    }
  }

  function showPopup(data) {
    ensureStyles();

    const backdrop=document.createElement('div');
    backdrop.className='modal-backdrop whats-new-backdrop';
    backdrop.setAttribute('aria-hidden','false');

    const modal=document.createElement('div');
    modal.className='modal whats-new-modal';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-labelledby','whatsNewTitle');

    const heading=document.createElement('div');
    heading.className='modal-heading';
    const copy=document.createElement('div');
    const eyebrow=document.createElement('span');
    eyebrow.className='eyebrow';
    eyebrow.textContent='PLUTO';
    const title=document.createElement('h2');
    title.id='whatsNewTitle';
    title.textContent='Nieuw sinds je laatste bezoek';
    copy.append(eyebrow,title);
    heading.append(copy);

    const body=document.createElement('div');
    body.className='whats-new-content';
    appendSection(body,'Nieuwe games',data.changes.games);
    appendSection(body,'Nieuwe features',data.changes.features);
    appendSection(body,'Verbeteringen',data.changes.improvements);

    const actions=document.createElement('div');
    actions.className='whats-new-actions';
    const close=document.createElement('button');
    close.className='primary';
    close.type='button';
    close.textContent='Oké';
    actions.append(close);

    modal.append(heading,body,actions);
    backdrop.append(modal);
    document.body.append(backdrop);

    let closing=false;
    const dismiss=async() => {
      if (closing) return;
      closing=true;
      await markSeen(data);
      backdrop.remove();
      document.removeEventListener('keydown',onKeydown);
    };
    const onKeydown=(event) => {
      if (event.key === 'Escape') dismiss();
    };

    close.addEventListener('click',dismiss);
    backdrop.addEventListener('click',(event) => {
      if (event.target === backdrop) dismiss();
    });
    document.addEventListener('keydown',onKeydown);
    requestAnimationFrame(() => close.focus());
  }

  async function checkUpdates() {
    try {
      const since=localStorage.getItem(STORAGE_KEY);
      const url=since ? `/api/updates?since=${encodeURIComponent(since)}` : '/api/updates';
      const response=await fetch(url,{cache:'no-store'});
      const data=await response.json();
      if (!response.ok || !data.ok || !data.currentVersion) return;

      if (!hasChanges(data.changes)) {
        if (!data.authenticated) localStorage.setItem(STORAGE_KEY,data.currentVersion);
        return;
      }

      showPopup(data);
    } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',checkUpdates,{once:true});
  else checkUpdates();
})();
