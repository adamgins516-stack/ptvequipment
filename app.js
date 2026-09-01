(function(){
  const root = document.getElementById('scanRoot');
  const params = new URLSearchParams(window.location.search);
  const itemId = params.get('id');

  let finished = false; // true once this page has shown a post-action "done" screen
  let scannerStream = null;

  function fmtTime(ts){
    if(!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', {month:'short', day:'numeric'}) + ' at ' +
           d.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'});
  }

  function clear(el){ while(el.firstChild) el.removeChild(el.firstChild); }

  function stopScanner(){
    if(scannerStream){
      scannerStream.getTracks().forEach(t => t.stop());
      scannerStream = null;
    }
  }
  window.addEventListener('pagehide', stopScanner);

  // Renders a live camera QR scanner into `container`. `onCancel` is called
  // if the user backs out without scanning anything.
  function renderScanner(container, onCancel){
    clear(container);

    const wrap = document.createElement('div');
    wrap.className = 'item-card';

    const hint = document.createElement('p');
    hint.className = 'scan-msg';
    hint.textContent = 'Starting camera…';
    wrap.appendChild(hint);

    const videoWrap = document.createElement('div');
    videoWrap.style.borderRadius = '12px';
    videoWrap.style.overflow = 'hidden';
    videoWrap.style.margin = '10px 0';
    videoWrap.style.background = '#000';
    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.muted = true;
    video.style.width = '100%';
    video.style.display = 'block';
    videoWrap.appendChild(video);
    wrap.appendChild(videoWrap);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-ghost btn-block';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      stopScanner();
      onCancel();
    });
    wrap.appendChild(cancelBtn);

    container.appendChild(wrap);

    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      hint.textContent = 'This browser can\'t open the camera here — use your phone\'s camera app to scan instead.';
      return;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } }).then((stream) => {
      scannerStream = stream;
      video.srcObject = stream;
      video.play();
      hint.textContent = 'Point your camera at a QR code';

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      function tick(){
        if(!scannerStream) return; // stopped
        if(video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth){
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = window.jsQR ? jsQR(imageData.data, imageData.width, imageData.height) : null;
          if(code && code.data){
            const text = code.data;
            if(text.indexOf(window.location.origin) === 0 && text.indexOf('id=') !== -1){
              hint.textContent = 'Found it!';
              stopScanner();
              window.location.href = text;
              return;
            } else {
              hint.textContent = 'That\'s not a Patriots TV equipment QR code — keep trying';
            }
          }
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }).catch(() => {
      hint.textContent = 'Camera access was denied or unavailable — use your phone\'s camera app to scan instead.';
    });
  }

  function renderEmpty(){
    clear(root);
    const box = document.createElement('div');
    box.className = 'empty-state';
    const p1 = document.createElement('p');
    p1.textContent = 'Scan an item\'s QR code to check it in or out.';
    box.appendChild(p1);

    const scanBtn = document.createElement('button');
    scanBtn.className = 'btn btn-primary';
    scanBtn.style.display = 'block';
    scanBtn.style.margin = '14px auto 0';
    scanBtn.textContent = 'Open Scanner';
    scanBtn.addEventListener('click', () => renderScanner(root, renderEmpty));
    box.appendChild(scanBtn);

    const link = document.createElement('a');
    link.href = 'admin.html';
    link.className = 'btn btn-outline btn-sm';
    link.style.display = 'inline-block';
    link.style.marginTop = '10px';
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

  function logHistory(item, action, person){
    firebase.database().ref('equipment/history').push({
      itemId: itemId,
      itemName: item.name,
      action: action,
      person: person,
      at: Date.now()
    });
  }

  // Shown right after a successful check-out/check-in: a confirmation plus
  // a way to jump straight into scanning the next item.
  function renderDone(message){
    finished = true;
    clear(root);

    const box = document.createElement('div');
    box.className = 'item-card';

    const success = document.createElement('div');
    success.className = 'success-box';
    success.textContent = message;
    box.appendChild(success);

    const scanBtn = document.createElement('button');
    scanBtn.className = 'btn btn-primary btn-lg btn-block';
    scanBtn.style.marginTop = '16px';
    scanBtn.textContent = 'Scan Another Item';
    scanBtn.addEventListener('click', () => {
      renderScanner(root, () => renderDone(message));
    });
    box.appendChild(scanBtn);

    const homeLink = document.createElement('a');
    homeLink.href = 'index.html';
    homeLink.className = 'btn btn-ghost btn-block';
    homeLink.style.marginTop = '8px';
    homeLink.style.textAlign = 'center';
    homeLink.textContent = 'Done for now';
    box.appendChild(homeLink);

    root.appendChild(box);
  }

  function checkOut(item, name){
    const ref = firebase.database().ref('equipment/items/' + itemId);
    ref.update({ status: 'out', holder: name, since: Date.now() }).then(() => {
      logHistory(item, 'checkout', name);
      renderDone('Checked out "' + item.name + '" to ' + name + ' ✓');
    }).catch(() => {
      finished = false;
      alert('Something went wrong — try again');
    });
  }

  function checkIn(item){
    const ref = firebase.database().ref('equipment/items/' + itemId);
    ref.update({ status: 'in', holder: null, since: Date.now() }).then(() => {
      logHistory(item, 'checkin', item.holder || 'Unknown');
      renderDone('Checked in "' + item.name + '" ✓');
    }).catch(() => {
      finished = false;
      alert('Something went wrong — try again');
    });
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
      if(finished) return; // don't let the live listener clobber the "done" / scan-next screen
      const item = snap.val();
      if(!item){ renderNotFound(); return; }
      if(item.archived){ renderArchived(item); return; }
      renderItem(item);
    }, () => {
      if(finished) return;
      clear(root);
      const box = document.createElement('div');
      box.className = 'empty-state';
      box.textContent = 'Could not connect. Check your internet connection and reload.';
      root.appendChild(box);
    });
  }
})();
