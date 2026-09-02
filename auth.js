(function(){
  // ============================================================
  // Same "keep honest people out" gate as the other internal PTV tools.
  // Anyone who views page source can read this password — it is NOT
  // real security. Do not put anything sensitive behind it.
  // Change it any time by editing the line below and redeploying.
  // ============================================================
  const SITE_PASSWORD = "equip67";

  const gate = document.getElementById('authGate');
  const form = document.getElementById('authForm');
  const input = document.getElementById('authPassword');
  const errorEl = document.getElementById('authError');

  input.focus();

  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(input.value === SITE_PASSWORD){
      gate.style.display = 'none';
    } else {
      errorEl.style.display = 'block';
      input.value = '';
      input.focus();
    }
  });
})();
