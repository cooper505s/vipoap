(() => {
  const choices = document.querySelectorAll('[data-wifi-problem]');
  const panel = document.getElementById('wifiResult');
  const title = document.getElementById('wifiResultTitle');
  const intro = document.getElementById('wifiResultIntro');
  const steps = document.getElementById('wifiResultSteps');

  if (!choices.length || !panel || !title || !intro || !steps) return;

  const guidance = {
    everywhere: {
      title: 'The whole connection may need checking',
      intro: 'If every room feels slow, the cause may be the broadband line, the router, or too many devices competing for the same connection.',
      steps: ['Restart the router and wait five minutes.', 'Test one device close to the router.', 'Check whether the problem happens at the same time each day.']
    },
    upstairs: {
      title: 'The signal may not be reaching upstairs properly',
      intro: 'Floors, thick walls and the position of the router can weaken the signal before it reaches bedrooms or an upstairs office.',
      steps: ['Keep the router out in the open, not inside a cupboard.', 'Avoid placing it behind a television or near large metal objects.', 'A mesh Wi-Fi system may be the simplest long-term answer.']
    },
    room: {
      title: 'That room may be a Wi-Fi dead spot',
      intro: 'One difficult room is often caused by thick walls, distance, mirrors, appliances or the way the house is laid out.',
      steps: ['Compare the signal just outside the room.', 'Move the router higher if possible.', 'A carefully placed mesh point may improve that room without changing everything else.']
    },
    tv: {
      title: 'The television may need a steadier connection',
      intro: 'Streaming uses a continuous connection, so a weak or busy Wi-Fi signal can cause buffering even when websites appear to work.',
      steps: ['Restart the television and router.', 'Check whether other devices are downloading at the same time.', 'Where practical, a wired connection or nearby mesh point can help.']
    },
    printer: {
      title: 'The printer may be connected to the wrong network',
      intro: 'Printers often lose their Wi-Fi connection after a router change, password change or software update.',
      steps: ['Check that the printer and your phone or computer use the same Wi-Fi name.', 'Restart the printer before reconnecting it.', 'Remove and re-add the printer if it still appears offline.']
    },
    calls: {
      title: 'Video calls need a stable signal in both directions',
      intro: 'A connection can look fast but still drop briefly, which causes frozen pictures or broken sound during calls.',
      steps: ['Move closer to the router for one test call.', 'Pause streaming or large downloads on other devices.', 'Check whether the problem is worse in one particular room.']
    }
  };

  choices.forEach((button) => {
    button.addEventListener('click', () => {
      const item = guidance[button.dataset.wifiProblem];
      if (!item) return;

      choices.forEach((choice) => choice.setAttribute('aria-pressed', 'false'));
      button.setAttribute('aria-pressed', 'true');
      title.textContent = item.title;
      intro.textContent = item.intro;
      steps.innerHTML = item.steps.map((step) => `<li>${step}</li>`).join('');
      panel.hidden = false;
      panel.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
    });
  });
})();