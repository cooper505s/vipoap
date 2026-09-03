(function () {
  if(!document.querySelector('link[data-vipoap-high-contrast]')){
    var contrastCss=document.createElement('link');
    contrastCss.rel='stylesheet';contrastCss.href='assets/high-contrast.css';contrastCss.dataset.vipoapHighContrast='true';
    document.head.appendChild(contrastCss);
  }
  var main = document.querySelector('main');
  if (main && !document.querySelector('.skip-link')) {
    if (!main.id) main.id = 'main-content';
    var skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = '#' + main.id;
    skip.textContent = 'Skip to main content';
    document.body.insertBefore(skip, document.body.firstChild);
  }
  var savedStep = parseFloat(localStorage.getItem('vipoapTextSize') || '1');
  var step = Math.min(1.35, Math.max(0.85, savedStep));
  document.documentElement.style.setProperty('--step', step);

  function setStep(value) {
    step = Math.min(1.35, Math.max(0.85, value));
    document.documentElement.style.setProperty('--step', step);
    localStorage.setItem('vipoapTextSize', String(step));
  }

  var headerActions = document.querySelector('.header-actions');
  if (headerActions && !document.getElementById('contrastToggle')) {
    var accessTools = document.createElement('div');
    accessTools.className = 'access-tools';
    accessTools.setAttribute('aria-label', 'Display options');
    accessTools.innerHTML = '<button class="tool-button" id="textSmaller" type="button" aria-label="Make text smaller">A−</button><button class="tool-button" id="textBigger" type="button" aria-label="Make text larger">A+</button><button class="tool-button" id="contrastToggle" type="button" aria-label="Switch high contrast mode" aria-pressed="false">Contrast</button>';
    headerActions.insertBefore(accessTools, headerActions.firstChild);
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
    cbStatus.textContent = 'Thank you. Your callback request has been sent to our team.';
    cbStatus.className = 'booking-status ok';
  }

}());

(function(){
  var nav=document.querySelector('.main-nav .nav-row');
  if(nav&&!nav.querySelector('[href="family-support.html"]')){var link=document.createElement('a');link.href='family-support.html';link.textContent='For Your Parents';var contact=nav.querySelector('[href="contact.html"]');nav.insertBefore(link,contact)}
  if(!/\/(index\.html)?$/.test(location.pathname))return;
  var main=document.querySelector('main');if(!main)return;
  var local=document.createElement('section');local.className='local-people';local.innerHTML='<div class="wrap local-grid"><div><span class="eyebrow">Local people, local support</span><h2>Your area is supported by its own VIPOAP technology specialist</h2><p>Each VIPOAP area is supported by approved local professionals who understand the community and provide friendly home technology help.</p><p>We are expanding carefully across the country. If we have not reached your area yet, we are sorry, but our aim is to eventually provide trusted local VIPOAP support throughout the UK.</p><div class="hero-actions"><a class="btn btn-primary" href="join-us.html">Join the VIPOAP network</a><a class="btn btn-secondary" href="stories.html">About our approach</a></div></div><div class="local-card"><h2>Interested in joining VIPOAP?</h2><p>Technically capable, patient local people can register their interest, complete VIPOAP checks and training, and become eligible for suitable customer bookings in their area.</p><a href="join-us.html"><strong>See the requirements and register &rarr;</strong></a></div></div>';main.appendChild(local);
  var before=local;
  var section=document.createElement('section');section.className='surface family-support-home';section.innerHTML='<div class="wrap local-grid"><div><span class="eyebrow">Helping from a distance</span><h2>Local technology support for your parents</h2><p>If you do not live nearby, or do not feel able to solve their technology problems, you can arrange and manage trusted VIPOAP support for a parent.</p><p>With their consent, you can be the family contact, manage visits and payment, and receive clear updates while they keep a familiar local person to call.</p><a class="btn btn-primary" href="family-support.html">See support for your parents</a></div><div class="local-card"><h2>They remain in control</h2><p>Your parent decides what help is provided and what may be shared with you. We record agreed contacts and keep routine updates clear and respectful.</p></div></div>';
  before.parentNode.insertBefore(section,before);
}());
