(function () {
  var savedStep = parseFloat(localStorage.getItem('vipoapTextSize') || '1');
  var step = Math.min(1.35, Math.max(0.85, savedStep));
  document.documentElement.style.setProperty('--step', step);

  function setStep(value) {
    step = Math.min(1.35, Math.max(0.85, value));
    document.documentElement.style.setProperty('--step', step);
    localStorage.setItem('vipoapTextSize', String(step));
  }

  var textBigger = document.getElementById('textBigger');
  var textSmaller = document.getElementById('textSmaller');
  if (textBigger) textBigger.addEventListener('click', function () { setStep(step + 0.1); });
  if (textSmaller) textSmaller.addEventListener('click', function () { setStep(step - 0.1); });

  var contrastBtn = document.getElementById('contrastToggle');
  var contrastOn = localStorage.getItem('vipoapContrast') === 'true';
  if (contrastOn) document.documentElement.classList.add('contrast');
  if (contrastBtn) {
    contrastBtn.setAttribute('aria-pressed', contrastOn ? 'true' : 'false');
    contrastBtn.addEventListener('click', function () {
      contrastOn = document.documentElement.classList.toggle('contrast');
      contrastBtn.setAttribute('aria-pressed', contrastOn ? 'true' : 'false');
      localStorage.setItem('vipoapContrast', contrastOn ? 'true' : 'false');
    });
  }

  var navToggle = document.getElementById('navToggle');
  var siteNav = document.getElementById('siteNav');
  if (navToggle && siteNav) {
    navToggle.addEventListener('click', function () {
      var isOpen = siteNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    siteNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        siteNav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  var cbStatus = document.getElementById('cbStatus');
  if (cbStatus && new URLSearchParams(window.location.search).get('callback') === 'sent') {
    cbStatus.textContent = 'Thank you. Your callback request has been sent to Dan.';
    cbStatus.className = 'booking-status ok';
  }

}());
