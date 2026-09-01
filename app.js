(function(){
  const root = document.getElementById('scanRoot');
  const params = new URLSearchParams(window.location.search);
  const itemId = params.get('id');

  function fmtTime(ts){
    if(!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', {month:'short', day:'numeric'}) + ' at ' +
           d.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'});
  }

  function clear(el){ while(el.firstChild) el.removeChild(el.firstChild); }

  function renderEmpty(){
    clear(root);
    const box = document.createElement('div');
    box.className = 'empty-state';
    const p1 = document.createElement('p');
    p1.textContent = 'Scan an item\'s QR code to check it in or out.';
    box.appendChild(p1);
    const link = document.createElement('a');
    link.href = 'admin.html';
    link.className = 'btn btn-outline btn-sm';
    link.style.display = 'inline-block';
    link.style.marginTop = '14px';
    link.textContent = 'Crew Admin';
    box.appendChild(link);
    root.appendChild(box);
  }

  function renderNotFound(){
    clear(root);
    const box = document.createElement('div');
    box.className = 'empty-state';
    box.textContent = 'Item not found. Ask an EP to check the QR code or re-add the item.';
    root.appendChild(box);
  }

  function renderArchived(item){
    clear(root);
    const box = document.createElement('div');
    box.className = 'empty-state';
    box.textContent = '"' + item.name + '" has been retired from inventory.';
    root.appendChild(box);
  }

  function loadRoster(cb){
    firebase.database().ref('equipment/roster').once('value').then((snap) => {
      const val = snap.val() || {};
      const names = Object.values(val).sort((a,b) => a.localeCompare(b));
      cb(names);
    }).catch(() => cb([]));
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

  function logHistory(item, action, person){
    firebase.database().ref('equipment/history').push({
      itemId: itemId,
      itemName: item.name,
      action: action,
      person: person,
      at: Date.now()
    });
  }

  function checkOut(item, name){
    const ref = firebase.database().ref('equipment/items/' + itemId);
    ref.update({ status: 'out', holder: name, since: Date.now() }).then(() => {
      logHistory(item, 'checkout', name);
      showToast('Checked out to ' + name);
    }).catch(() => showToast('Something went wrong — try again'));
  }

  function checkIn(item){
    const ref = firebase.database().ref('equipment/items/' + itemId);
    ref.update({ status: 'in', holder: null, since: Date.now() }).then(() => {
      logHistory(item, 'checkin', item.holder || 'Unknown');
      showToast('Checked in ✓');
    }).catch(() => showToast('Something went wrong — try again'));
  }

  function renderItem(item){
    clear(root);
    const card = document.createElement('div');
    card.className = 'item-card';

    const name = document.createElement('p');
    name.className = 'item-name';
    name.textContent = item.name;
    card.appendChild(name);

    if(item.category){
      const cat = document.createElement('span');
      cat.className = 'badge-cat';
      cat.textContent = item.category;
      card.appendChild(cat);
    }

    if(item.notes){
      const notes = document.createElement('p');
      notes.className = 'item-notes';
      notes.textContent = item.notes;
      card.appendChild(notes);
    }

    const isOut = item.status === 'out';
    const statusBadge = document.createElement('p');
    statusBadge.style.marginTop = '14px';
    const badge = document.createElement('span');
    badge.className = 'badge-status ' + (isOut ? 'badge-out' : 'badge-in');
    badge.textContent = isOut ? 'Checked Out' : 'Available';
    statusBadge.appendChild(badge);
    card.appendChild(statusBadge);

    if(isOut){
      const holderLine = document.createElement('p');
      holderLine.className = 'holder-line';
      const b = document.createElement('b');
      b.textContent = item.holder || 'Unknown';
      holderLine.appendChild(document.createTextNode('Has it: '));
      holderLine.appendChild(b);
      if(item.since){
        holderLine.appendChild(document.createTextNode(' · since ' + fmtTime(item.since)));
      }
      card.appendChild(holderLine);

      const btn = document.createElement('button');
      btn.className = 'btn btn-primary btn-lg btn-block';
      btn.textContent = 'Check In';
      btn.addEventListener('click', () => {
        btn.disabled = true;
        checkIn(item);
      });
      card.appendChild(btn);
    } else {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary btn-lg btn-block';
      btn.textContent = 'Check Out';
      btn.addEventListener('click', () => {
        btn.style.display = 'none';
        const msg = document.createElement('p');
        msg.className = 'scan-msg';
        msg.textContent = 'Tap your name:';
        card.appendChild(msg);

        const grid = document.createElement('div');
        grid.className = 'name-grid';
        loadRoster((names) => {
          if(names.length === 0){
            grid.innerHTML = '';
            const none = document.createElement('p');
            none.className = 'scan-msg';
            none.textContent = 'No crew names set up yet — add them in Crew Admin → Roster.';
            grid.appendChild(none);
            return;
          }
          names.forEach((n) => {
            const nb = document.createElement('button');
            nb.className = 'name-btn';
            nb.textContent = n;
            nb.addEventListener('click', () => {
              grid.querySelectorAll('button').forEach(b2 => b2.disabled = true);
              checkOut(item, n);
            });
            grid.appendChild(nb);
          });
        });
        card.appendChild(grid);
      });
      card.appendChild(btn);
    }

    root.appendChild(card);
  }

  if(!itemId){
    renderEmpty();
  } else {
    const ref = firebase.database().ref('equipment/items/' + itemId);
    ref.on('value', (snap) => {
      const item = snap.val();
      if(!item){ renderNotFound(); return; }
      if(item.archived){ renderArchived(item); return; }
      renderItem(item);
    }, () => {
      clear(root);
      const box = document.createElement('div');
      box.className = 'empty-state';
      box.textContent = 'Could not connect. Check your internet connection and reload.';
      root.appendChild(box);
    });
  }
})();
