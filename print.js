(function(){
  // QR codes always encode the branded custom domain, regardless of which
  // URL this print page itself happens to be opened from.
  const SITE_URL = 'https://equipment.ahspatriotstv.com';

  const sheetEl = document.getElementById('labelSheet');
  const noteEl = document.getElementById('printNote');
  const params = new URLSearchParams(window.location.search);
  const ids = (params.get('ids') || '').split(',').filter(Boolean);
  const sheetType = ['standard', 'avery22807', 'avery2160'].includes(params.get('sheet')) ? params.get('sheet') : 'standard';
  const per = sheetType === 'standard' ? 1 : Math.min(3, Math.max(1, parseInt(params.get('per'), 10) || 1));

  sheetEl.className = 'label-sheet sheet-' + sheetType + ' per-' + per;

  const notes = {
    standard: 'Prints on standard letter paper — 3 labels per row, cut along the dashed lines.',
    avery22807: 'Sized for Avery 22807 (2" round, 12/sheet). Alignment is our best estimate from Avery\'s published label size (they don\'t publish exact margins for this one) — print one test page on plain paper first and check it against a blank sheet before printing on actual labels. In the print dialog, set Margins to "None".',
    avery2160: 'Sized for Avery 2160 (1" x 2-5/8", 30/sheet, standard letter page — same layout as Avery 5160/8160). In the print dialog, set Margins to "None" so this lines up correctly.'
  };
  noteEl.textContent = notes[sheetType] + (per > 1 ? ' Each label holds ' + per + ' items.' : '');

  document.getElementById('printBtn').addEventListener('click', () => window.print());

  if(ids.length === 0){
    sheetEl.textContent = 'No items selected. Go back to Crew Admin → Inventory and pick items to print.';
    return;
  }

  const itemsRef = firebase.database().ref('equipment/items');
  itemsRef.once('value').then((snap) => {
    const items = snap.val() || {};
    const validIds = ids.filter((id) => items[id]);

    if(validIds.length === 0){
      sheetEl.textContent = 'None of the selected items could be found — they may have been deleted.';
      return;
    }

    const groups = [];
    for(let i = 0; i < validIds.length; i += per){
      groups.push(validIds.slice(i, i + per));
    }

    groups.forEach((group) => {
      const cell = document.createElement('div');
      cell.className = 'label-cell';

      group.forEach((id) => {
        const it = items[id];
        const url = SITE_URL + '/?id=' + id;

        const mini = document.createElement('div');
        mini.className = 'mini-item';

        const img = document.createElement('img');
        mini.appendChild(img);

        const name = document.createElement('div');
        name.className = 'mini-name';
        name.textContent = it.name;
        mini.appendChild(name);

        cell.appendChild(mini);

        QRCode.toDataURL(url, { width: 200, margin: 0 }, function(err, dataUrl){
          if(!err) img.src = dataUrl;
        });
      });

      sheetEl.appendChild(cell);
    });
  });
})();
