(function(){
  const itemsRef = firebase.database().ref('equipment/items');
  const historyRef = firebase.database().ref('equipment/history');
  const rosterRef = firebase.database().ref('equipment/roster');

  let items = {};
  let history = {};
  let roster = {};
  let loaded = { items:false, history:false, roster:false };

  let inventoryFilter = 'all'; // 'all' | 'archived' | category name
  let selectedIds = new Set();
  let editingId = null; // null = add mode, else editing this item id
  let historySearch = '';

  function clear(el){ while(el.firstChild) el.removeChild(el.firstChild); }

  function fmtTime(ts){
    if(!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', {month:'short', day:'numeric'}) + ' at ' +
           d.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'});
  }

  function genId(){
    let id;
    do {
      id = Math.random().toString(36).slice(2, 8);
    } while(items[id]);
    return id;
  }

  let toastTimer = null;
  function showToast(msg){
    let t = document.getElementById('toast');
    if(!t){
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function categories(){
    const set = new Set();
    Object.values(items).forEach(it => { if(it.category) set.add(it.category); });
    return Array.from(set).sort((a,b) => a.localeCompare(b));
  }

  function activeItems(){
    return Object.entries(items).filter(([,it]) => !it.archived);
  }

  // ---------------- Firebase listeners ----------------
  itemsRef.on('value', (snap) => { items = snap.val() || {}; loaded.items = true; renderAll(); });
  historyRef.on('value', (snap) => { history = snap.val() || {}; loaded.history = true; renderAll(); });
  rosterRef.on('value', (snap) => { roster = snap.val() || {}; loaded.roster = true; renderAll(); });

  function renderAll(){
    if(!loaded.items || !loaded.history || !loaded.roster) return;
    renderDashboard();
    renderInventory();
    renderHistory();
    renderRoster();
  }

  // ---------------- Shared actions ----------------
  function logHistory(itemId, itemName, action, person){
    historyRef.push({ itemId, itemName, action, person, at: Date.now() });
  }

  function forceCheckIn(id){
    const item = items[id];
    if(!item) return;
    itemsRef.child(id).update({ status:'in', holder:null, since: Date.now() }).then(() => {
      logHistory(id, item.name, 'checkin', item.holder || 'Unknown');
      showToast('Checked in "' + item.name + '"');
    });
  }

  // ---------------- Dashboard ----------------
  function renderDashboard(){
    const view = document.getElementById('dashboardView');
    clear(view);

    const active = activeItems();
    const outItems = active.filter(([,it]) => it.status === 'out');
    const inCount = active.length - outItems.length;

    const stats = document.createElement('div');
    stats.className = 'stats-row';
    [
      ['Total Items', active.length],
      ['Checked Out', outItems.length],
      ['Available', inCount]
    ].forEach(([label, num]) => {
      const box = document.createElement('div');
      box.className = 'stat-box';
      const n = document.createElement('div'); n.className = 'stat-num'; n.textContent = num;
      const l = document.createElement('div'); l.className = 'stat-label'; l.textContent = label;
      box.appendChild(n); box.appendChild(l);
      stats.appendChild(box);
    });
    view.appendChild(stats);

    const title = document.createElement('p');
    title.className = 'section-title';
    title.textContent = 'Currently Out';
    view.appendChild(title);

    if(outItems.length === 0){
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Nothing checked out right now.';
      view.appendChild(empty);
      return;
    }

    outItems.sort((a,b) => (a[1].since||0) - (b[1].since||0));

    const card = document.createElement('div');
    card.className = 'card';
    outItems.forEach(([id, it]) => {
      const row = document.createElement('div');
      row.className = 'item-row';

      const stack = document.createElement('div');
      stack.className = 'stack';
      const n = document.createElement('strong'); n.textContent = it.name;
      const m = document.createElement('span');
      m.style.fontSize = '12.5px'; m.style.color = 'var(--ink-soft)';
      m.textContent = (it.holder || 'Unknown') + ' · since ' + fmtTime(it.since);
      stack.appendChild(n); stack.appendChild(m);
      row.appendChild(stack);

      const btn = document.createElement('button');
      btn.className = 'btn btn-outline btn-sm';
      btn.textContent = 'Check In';
      btn.addEventListener('click', () => forceCheckIn(id));
      row.appendChild(btn);

      card.appendChild(row);
    });
    view.appendChild(card);
  }

  // ---------------- Inventory ----------------
  function renderInventory(){
    const view = document.getElementById('inventoryView');
    clear(view);

    const topRow = document.createElement('div');
    topRow.className = 'row';
    topRow.style.marginBottom = '12px';

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary';
    addBtn.textContent = '+ Add Item';
    addBtn.addEventListener('click', () => openItemModal(null));
    topRow.appendChild(addBtn);

    const printWrap = document.createElement('div');
    printWrap.style.display = 'flex';
    printWrap.style.gap = '6px';

    const printSelBtn = document.createElement('button');
    printSelBtn.className = 'btn btn-outline btn-sm';
    printSelBtn.textContent = 'Print Selected (' + selectedIds.size + ')';
    printSelBtn.disabled = selectedIds.size === 0;
    printSelBtn.addEventListener('click', () => {
      window.open('print.html?ids=' + Array.from(selectedIds).join(','), '_blank');
    });
    printWrap.appendChild(printSelBtn);

    const printAllBtn = document.createElement('button');
    printAllBtn.className = 'btn btn-outline btn-sm';
    printAllBtn.textContent = 'Print All';
    printAllBtn.addEventListener('click', () => {
      const ids = activeItems().map(([id]) => id);
      if(ids.length === 0){ showToast('No items yet'); return; }
      window.open('print.html?ids=' + ids.join(','), '_blank');
    });
    printWrap.appendChild(printAllBtn);

    topRow.appendChild(printWrap);
    view.appendChild(topRow);

    const chipBar = document.createElement('div');
    chipBar.className = 'chip-filter';
    const filters = ['all'].concat(categories()).concat(['archived']);
    filters.forEach(f => {
      const chip = document.createElement('button');
      chip.className = 'chip' + (inventoryFilter === f ? ' active' : '');
      chip.textContent = f === 'all' ? 'All' : (f === 'archived' ? 'Archived' : f);
      chip.addEventListener('click', () => { inventoryFilter = f; renderInventory(); });
      chipBar.appendChild(chip);
    });
    view.appendChild(chipBar);

    let entries = Object.entries(items);
    if(inventoryFilter === 'archived'){
      entries = entries.filter(([,it]) => it.archived);
    } else {
      entries = entries.filter(([,it]) => !it.archived);
      if(inventoryFilter !== 'all'){
        entries = entries.filter(([,it]) => it.category === inventoryFilter);
      }
    }
    entries.sort((a,b) => a[1].name.localeCompare(b[1].name));

    if(entries.length === 0){
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = inventoryFilter === 'archived' ? 'No archived items.' : 'No items yet — add your first one above.';
      view.appendChild(empty);
      return;
    }

    const card = document.createElement('div');
    card.className = 'card';

    entries.forEach(([id, it]) => {
      const row = document.createElement('div');
      row.className = 'item-row';

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'flex-start';
      left.style.gap = '10px';

      if(!it.archived){
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = selectedIds.has(id);
        cb.style.marginTop = '4px';
        cb.addEventListener('change', () => {
          if(cb.checked) selectedIds.add(id); else selectedIds.delete(id);
          renderInventory();
        });
        left.appendChild(cb);
      }

      const stack = document.createElement('div');
      stack.className = 'stack';
      const nameRow = document.createElement('div');
      const n = document.createElement('strong'); n.textContent = it.name;
      nameRow.appendChild(n);
      stack.appendChild(nameRow);

      const metaRow = document.createElement('div');
      metaRow.style.display = 'flex'; metaRow.style.gap = '6px'; metaRow.style.flexWrap = 'wrap'; metaRow.style.marginTop = '3px';
      if(it.category){
        const cat = document.createElement('span'); cat.className = 'badge-cat'; cat.textContent = it.category;
        metaRow.appendChild(cat);
      }
      if(!it.archived){
        const badge = document.createElement('span');
        badge.className = 'badge-status ' + (it.status === 'out' ? 'badge-out' : 'badge-in');
        badge.textContent = it.status === 'out' ? 'Out — ' + (it.holder||'?') : 'Available';
        metaRow.appendChild(badge);
      }
      stack.appendChild(metaRow);
      left.appendChild(stack);
      row.appendChild(left);

      const actions = document.createElement('div');
      actions.className = 'item-row-actions';

      if(!it.archived){
        const qrBtn = document.createElement('button');
        qrBtn.className = 'btn btn-outline btn-sm';
        qrBtn.textContent = 'QR';
        qrBtn.addEventListener('click', () => openQrModal(id, it.name));
        actions.appendChild(qrBtn);

        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-outline btn-sm';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => openItemModal(id));
        actions.appendChild(editBtn);

        if(it.status === 'out'){
          const ciBtn = document.createElement('button');
          ciBtn.className = 'btn btn-outline btn-sm';
          ciBtn.textContent = 'Check In';
          ciBtn.addEventListener('click', () => forceCheckIn(id));
          actions.appendChild(ciBtn);
        }

        const archBtn = document.createElement('button');
        archBtn.className = 'btn btn-ghost btn-sm';
        archBtn.textContent = 'Archive';
        archBtn.addEventListener('click', () => {
          if(!confirm('Archive "' + it.name + '"? It will be hidden from the scan flow and can be restored later.')) return;
          itemsRef.child(id).update({ archived:true });
          selectedIds.delete(id);
        });
        actions.appendChild(archBtn);
      } else {
        const restoreBtn = document.createElement('button');
        restoreBtn.className = 'btn btn-outline btn-sm';
        restoreBtn.textContent = 'Restore';
        restoreBtn.addEventListener('click', () => itemsRef.child(id).update({ archived:false }));
        actions.appendChild(restoreBtn);

        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-danger btn-sm';
        delBtn.textContent = 'Delete Forever';
        delBtn.addEventListener('click', () => {
          if(!confirm('Permanently delete "' + it.name + '"? This cannot be undone.')) return;
          itemsRef.child(id).remove();
        });
        actions.appendChild(delBtn);
      }

      row.appendChild(actions);
      card.appendChild(row);
    });

    view.appendChild(card);
  }

  // ---------------- Item add/edit modal ----------------
  const itemModal = document.getElementById('itemModal');
  const itemModalTitle = document.getElementById('itemModalTitle');
  const itemForm = document.getElementById('itemForm');
  const itemNameInput = document.getElementById('itemNameInput');
  const itemCategoryInput = document.getElementById('itemCategoryInput');
  const itemNotesInput = document.getElementById('itemNotesInput');
  const categoryList = document.getElementById('categoryList');

  function openItemModal(id){
    editingId = id;
    const it = id ? items[id] : null;
    itemModalTitle.textContent = id ? 'Edit Item' : 'Add Item';
    itemNameInput.value = it ? it.name : '';
    itemCategoryInput.value = it ? (it.category || '') : '';
    itemNotesInput.value = it ? (it.notes || '') : '';
    clear(categoryList);
    categories().forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      categoryList.appendChild(opt);
    });
    itemModal.classList.add('active');
    itemNameInput.focus();
  }
  function closeItemModal(){ itemModal.classList.remove('active'); editingId = null; itemForm.reset(); }
  document.getElementById('itemModalClose').addEventListener('click', closeItemModal);
  itemModal.addEventListener('click', (e) => { if(e.target === itemModal) closeItemModal(); });

  itemForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = itemNameInput.value.trim();
    if(!name) return;
    const category = itemCategoryInput.value.trim();
    const notes = itemNotesInput.value.trim();

    if(editingId){
      itemsRef.child(editingId).update({ name, category, notes });
      showToast('Saved');
    } else {
      const id = genId();
      itemsRef.child(id).set({
        name, category, notes,
        status: 'in', holder: null, since: Date.now(),
        addedAt: Date.now(), archived: false
      });
      showToast('Added "' + name + '"');
    }
    closeItemModal();
  });

  // ---------------- QR modal ----------------
  const qrModal = document.getElementById('qrModal');
  const qrModalTitle = document.getElementById('qrModalTitle');
  const qrModalUrl = document.getElementById('qrModalUrl');
  const qrCanvas = document.getElementById('qrCanvas');
  const qrDownloadBtn = document.getElementById('qrDownloadBtn');
  let currentQrName = 'item';

  function openQrModal(id, name){
    currentQrName = name;
    const url = window.location.origin + '/?id=' + id;
    qrModalTitle.textContent = name;
    qrModalUrl.textContent = url;
    QRCode.toCanvas(qrCanvas, url, { width: 220, margin: 1 }, function(err){
      if(err) showToast('Could not generate QR code');
    });
    qrModal.classList.add('active');
  }
  document.getElementById('qrModalClose').addEventListener('click', () => qrModal.classList.remove('active'));
  qrModal.addEventListener('click', (e) => { if(e.target === qrModal) qrModal.classList.remove('active'); });
  qrDownloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = currentQrName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-qr.png';
    link.href = qrCanvas.toDataURL('image/png');
    link.click();
  });

  // ---------------- History ----------------
  function renderHistory(){
    const view = document.getElementById('historyView');
    clear(view);

    const searchField = document.createElement('input');
    searchField.type = 'text';
    searchField.placeholder = 'Filter by item or name…';
    searchField.value = historySearch;
    searchField.style.width = '100%';
    searchField.style.padding = '10px';
    searchField.style.border = '1px solid var(--line)';
    searchField.style.borderRadius = '8px';
    searchField.style.marginBottom = '12px';
    searchField.addEventListener('input', (e) => { historySearch = e.target.value; renderHistory(); });
    view.appendChild(searchField);

    let entries = Object.entries(history);
    const q = historySearch.trim().toLowerCase();
    if(q){
      entries = entries.filter(([,h]) =>
        (h.itemName||'').toLowerCase().includes(q) || (h.person||'').toLowerCase().includes(q)
      );
    }
    entries.sort((a,b) => (b[1].at||0) - (a[1].at||0));

    if(entries.length === 0){
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No history yet.';
      view.appendChild(empty);
      return;
    }

    const card = document.createElement('div');
    card.className = 'card';
    entries.slice(0, 300).forEach(([, h]) => {
      const row = document.createElement('div');
      row.className = 'history-row';
      const line = document.createElement('div');
      const strongName = document.createElement('strong');
      strongName.textContent = h.itemName || '(deleted item)';
      line.appendChild(strongName);
      line.appendChild(document.createTextNode(
        ' — ' + (h.action === 'checkout' ? 'checked out by ' : 'checked in by ') + (h.person || 'Unknown')
      ));
      row.appendChild(line);
      const time = document.createElement('div');
      time.className = 'history-time';
      time.textContent = fmtTime(h.at);
      row.appendChild(time);
      card.appendChild(row);
    });
    view.appendChild(card);
  }

  // ---------------- Roster ----------------
  function renderRoster(){
    const view = document.getElementById('rosterView');
    clear(view);

    const card = document.createElement('div');
    card.className = 'card';

    const p = document.createElement('p');
    p.style.fontSize = '13px'; p.style.color = 'var(--ink-soft)'; p.style.marginTop = '0';
    p.textContent = 'These names appear on the scan page when someone checks out an item.';
    card.appendChild(p);

    const names = Object.entries(roster).sort((a,b) => a[1].localeCompare(b[1]));
    if(names.length === 0){
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No crew names yet — add some below.';
      card.appendChild(empty);
    } else {
      const wrap = document.createElement('div');
      names.forEach(([id, n]) => {
        const chip = document.createElement('span');
        chip.className = 'roster-chip';
        chip.appendChild(document.createTextNode(n));
        const x = document.createElement('button');
        x.textContent = '✕';
        x.addEventListener('click', () => {
          if(confirm('Remove ' + n + ' from the roster?')) rosterRef.child(id).remove();
        });
        chip.appendChild(x);
        wrap.appendChild(chip);
      });
      card.appendChild(wrap);
    }

    const form = document.createElement('form');
    form.style.display = 'flex';
    form.style.gap = '8px';
    form.style.marginTop = '14px';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Add crew name…';
    input.style.flex = '1';
    input.style.padding = '10px';
    input.style.border = '1px solid var(--line)';
    input.style.borderRadius = '8px';
    form.appendChild(input);
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary';
    addBtn.type = 'submit';
    addBtn.textContent = 'Add';
    form.appendChild(addBtn);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if(!val) return;
      const exists = Object.values(roster).some(n => n.toLowerCase() === val.toLowerCase());
      if(exists){ showToast(val + ' is already on the roster'); return; }
      rosterRef.push(val);
      input.value = '';
    });
    card.appendChild(form);

    view.appendChild(card);
  }

  // ---------------- Tabs ----------------
  const tabs = {
    dashboard: [document.getElementById('tabDashboard'), document.getElementById('dashboardView')],
    inventory: [document.getElementById('tabInventory'), document.getElementById('inventoryView')],
    history:   [document.getElementById('tabHistory'), document.getElementById('historyView')],
    roster:    [document.getElementById('tabRoster'), document.getElementById('rosterView')]
  };
  function switchTab(which){
    Object.entries(tabs).forEach(([key, [btn, panel]]) => {
      btn.classList.toggle('active', key === which);
      panel.style.display = key === which ? '' : 'none';
    });
  }
  tabs.dashboard[0].addEventListener('click', () => switchTab('dashboard'));
  tabs.inventory[0].addEventListener('click', () => switchTab('inventory'));
  tabs.history[0].addEventListener('click', () => switchTab('history'));
  tabs.roster[0].addEventListener('click', () => switchTab('roster'));
})();
