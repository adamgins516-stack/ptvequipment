(function(){
  const sheet = document.getElementById('labelSheet');
  const params = new URLSearchParams(window.location.search);
  const ids = (params.get('ids') || '').split(',').filter(Boolean);

  document.getElementById('printBtn').addEventListener('click', () => window.print());

  if(ids.length === 0){
    sheet.textContent = 'No items selected. Go back to Crew Admin → Inventory and pick items to print.';
    return;
  }

  const itemsRef = firebase.database().ref('equipment/items');
  itemsRef.once('value').then((snap) => {
    const items = snap.val() || {};
    ids.forEach((id) => {
      const it = items[id];
      if(!it) return;
      const url = window.location.origin + '/?id=' + id;

      const card = document.createElement('div');
      card.className = 'label-card';

      const img = document.createElement('img');
      card.appendChild(img);

      const name = document.createElement('div');
      name.className = 'label-name';
      name.textContent = it.name;
      card.appendChild(name);

      if(it.category){
        const cat = document.createElement('div');
        cat.className = 'label-cat';
        cat.textContent = it.category;
        card.appendChild(cat);
      }

      sheet.appendChild(card);

      QRCode.toDataURL(url, { width: 220, margin: 1 }, function(err, dataUrl){
        if(!err) img.src = dataUrl;
      });
    });

    if(sheet.children.length === 0){
      sheet.textContent = 'None of the selected items could be found — they may have been deleted.';
    }
  });
})();
