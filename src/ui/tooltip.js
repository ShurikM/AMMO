export function initTooltip() {
  const tip = document.getElementById('global-tip');
  document.addEventListener('mouseover', function(e) {
    const icon = e.target.closest('.info-icon');
    if (!icon || !icon.dataset.tip) { tip.style.display = 'none'; return; }
    tip.innerHTML = icon.dataset.tip;
    tip.style.display = 'block';
    positionTip(e);
  });
  document.addEventListener('mousemove', function(e) {
    if (!e.target.closest('.info-icon')) return;
    positionTip(e);
  });
  document.addEventListener('mouseout', function(e) {
    if (!e.target.closest('.info-icon')) return;
    tip.style.display = 'none';
  });
  function positionTip(e) {
    const margin = 12;
    const tw = 210, th = tip.offsetHeight || 100;
    let x = e.clientX + margin;
    let y = e.clientY - th / 2;
    if (x + tw > window.innerWidth - 8) x = e.clientX - tw - margin;
    if (y < 8) y = 8;
    if (y + th > window.innerHeight - 8) y = window.innerHeight - th - 8;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }
}
