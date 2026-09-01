(function(){
  const root = document.getElementById('scanRoot');
  const params = new URLSearchParams(window.location.search);
  const itemId = params.get('id');

  let finished = false; // true once this page has shown a post-action "done" screen
  let scannerStream = null;

  function firstName(fullName){
    if(!fullName) return '';
    return String(fullName).trim().split(/\s+/)[0];
  }

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

  // Roster names, alphabetized by first name, "Other" always last.
  function loadRoster(cb){
    firebase.database().ref('equipment/roster').once('value').then((snap) => {
      const val = snap.val() || {};
      const names = Object.values(val).sort((a,b) => firstName(a).localeCompare(firstName(b)));
      cb(names);
    }).catch(() => cb([]));
  }

  // Renders "Tap your name:" + the roster grid (+ "Other") into `container`.
  // Calls onChosen(name) once a name is picked or typed.
  function renderNamePicker(container, onChosen){
    const msg = document.createElement('p');
    msg.className = 'scan-msg';
    msg.textContent = 'Tap your name:';
    container.appendChild(msg);

    const grid = document.createElement('div');
    grid.className = 'name-grid';
    container.appendChild(grid);

    loadRoster((names) => {
      names.forEach((n) => {
        const nb = document.createElement('button');
        nb.className = 'name-btn';
        nb.textContent = firstName(n);
        nb.addEventListener('click', () => onChosen(n));
        grid.appendChild(nb);
      });

      const otherBtn = document.createElement('button');
      otherBtn.className = 'name-btn';
      otherBtn.textContent = 'Other';
      otherBtn.addEventListener('click', () => {
        clear(grid);

        const otherField = document.createElement('div');
        otherField.className = 'field';
        const otherInput = document.createElement('input');
        otherInput.type = 'text';
        otherInput.placeholder = 'Type your name';
        otherField.appendChild(otherInput);
        grid.appendChild(otherField);

        const continueBtn = document.createElement('button');
        continueBtn.className = 'btn btn-primary btn-block';
        continueBtn.textContent = 'Continue';
        grid.appendChild(continueBtn);

        function submitOther(){
          const val = otherInput.value.trim();
          if(!val) { otherInput.focus(); return; }
          onChosen(val);
        }
        continueBtn.addEventListener('click', submitOther);
        otherInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') submitOther(); });
        otherInput.focus();
      });
      grid.appendChild(otherBtn);

      if(names.length === 0){
        const none = document.createElement('p');
        none.className = 'scan-msg';
        none.textContent = 'No other crew names set up yet — add them in Crew Admin → Roster.';
        container.appendChild(none);
      }
    });
  }

  function logHistory(item, action, person, reason){
    const entry = {
      itemId: itemId,
      itemName: item.name,
      action: action,
      person: person,
      at: Date.now()
    };
    if(reason) entry.reason = reason;
    firebase.database().ref('equipment/history').push(entry);
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

  function checkOut(item, name, reason){
    const ref = firebase.database().ref('equipment/items/' + itemId);
    ref.update({ status: 'out', holder: name, reason: reason, since: Date.now() }).then(() => {
      logHistory(item, 'checkout', name, reason);
      renderDone('Checked out "' + item.name + '" to ' + firstName(name) + ' ✓');
    }).catch(() => {
      finished = false;
      alert('Something went wrong — try again');
    });
  }

  function checkIn(item){
    const ref = firebase.database().ref('equipment/items/' + itemId);
    ref.update({ status: 'in', holder: null, reason: null, since: Date.now() }).then(() => {
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
      b.textContent = firstName(item.holder) || 'Unknown';
      holderLine.appendChild(document.createTextNode('Has it: '));
      holderLine.appendChild(b);
      if(item.since){
        holderLine.appendChild(document.createTextNode(' · since ' + fmtTime(item.since)));
      }
      card.appendChild(holderLine);

      if(item.reason){
        const reasonLine = document.createElement('p');
        reasonLine.className = 'holder-line';
        reasonLine.style.marginTop = '-8px';
        reasonLine.style.color = 'var(--ink-soft)';
        reasonLine.textContent = 'Reason: ' + item.reason;
        card.appendChild(reasonLine);
      }

      const btn = document.createElement('button');
      btn.className = 'btn btn-primary btn-lg btn-block';
      btn.textContent = 'Check In';

      const ciStepArea = document.createElement('div');

      function handleCheckInName(name){
        clear(ciStepArea);
        if(firstName(name).toLowerCase() === firstName(item.holder).toLowerCase()){
          const checking = document.createElement('p');
          checking.className = 'scan-msg';
          checking.textContent = 'Checking in…';
          ciStepArea.appendChild(checking);
          checkIn(item);
        } else {
          const oops = document.createElement('div');
          oops.className = 'error-box';
          oops.textContent = 'Oops — ' + firstName(item.holder) + ' checked this out, not ' + firstName(name) + '. Only they can check it in.';
          ciStepArea.appendChild(oops);

          const tryAgainBtn = document.createElement('button');
          tryAgainBtn.className = 'btn btn-outline btn-block';
          tryAgainBtn.style.marginTop = '10px';
          tryAgainBtn.textContent = 'Try Again';
          tryAgainBtn.addEventListener('click', () => {
            clear(ciStepArea);
            renderNamePicker(ciStepArea, handleCheckInName);
          });
          ciStepArea.appendChild(tryAgainBtn);
        }
      }

      btn.addEventListener('click', () => {
        btn.style.display = 'none';
        renderNamePicker(ciStepArea, handleCheckInName);
        card.appendChild(ciStepArea);
      });
      card.appendChild(btn);
    } else {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary btn-lg btn-block';
      btn.textContent = 'Check Out';

      const stepArea = document.createElement('div');

      // Step 2: reason, once a name has been picked/typed.
      function showReasonStep(selectedName){
        clear(stepArea);

        const who = document.createElement('p');
        who.className = 'scan-msg';
        who.textContent = 'Checking out to ' + firstName(selectedName) + ':';
        stepArea.appendChild(who);

        const field = document.createElement('div');
        field.className = 'field';
        const label = document.createElement('label');
        label.textContent = 'What\'s it for?';
        field.appendChild(label);
        const reasonInput = document.createElement('input');
        reasonInput.type = 'text';
        reasonInput.placeholder = 'e.g. Friday\'s show, B-roll for a package';
        field.appendChild(reasonInput);
        stepArea.appendChild(field);

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn btn-primary btn-lg btn-block';
        confirmBtn.textContent = 'Confirm Check Out';
        confirmBtn.disabled = true;
        stepArea.appendChild(confirmBtn);

        reasonInput.addEventListener('input', () => {
          confirmBtn.disabled = reasonInput.value.trim().length === 0;
        });
        reasonInput.focus();

        confirmBtn.addEventListener('click', () => {
          confirmBtn.disabled = true;
          reasonInput.disabled = true;
          checkOut(item, selectedName, reasonInput.value.trim());
        });
      }

      btn.addEventListener('click', () => {
        btn.style.display = 'none';
        renderNamePicker(stepArea, showReasonStep);
        card.appendChild(stepArea);
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
