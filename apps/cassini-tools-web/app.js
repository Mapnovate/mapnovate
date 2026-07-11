'use strict';
(function () {
  const CE = window.CassiniEngine;
  const net = new CE.ControlNet(window.CASSINI_CONTROL_NET);
  const $ = id => document.getElementById(id);

  // stat: real control count
  const total = Object.values(net.groups).reduce((a, v) => a + v.length, 0);
  $('s_pts').textContent = total;

  let dir = 'c2u';

  // ---- direction toggle ----
  $('dirToggle').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    dir = b.dataset.dir;
    [...$('dirToggle').children].forEach(x => x.classList.toggle('on', x === b));
    updateLabels();
  });

  function updateLabels() {
    if (dir === 'c2u') {
      $('lblIn').children[0].textContent = 'Input — Cassini';
      $('unitIn').textContent = 'X  Y in feet';
      $('lblOut').children[0].textContent = 'Output — UTM Arc 1960';
      $('unitOut').textContent = 'E  N in metres';
      $('output').placeholder = 'Results — E  N  ·  belt  ·  nearest control';
    } else {
      $('lblIn').children[0].textContent = 'Input — UTM Arc 1960';
      $('unitIn').textContent = 'E  N in metres';
      $('lblOut').children[0].textContent = 'Output — Cassini';
      $('unitOut').textContent = 'X  Y in feet';
      $('output').placeholder = 'Results — X  Y  ·  belt  ·  nearest control';
    }
    $('input').value = '';
    $('output').value = '';
  }

  // ---- sample loader ----
  $('loadSample').addEventListener('click', () => {
    const key = dir === 'c2u' ? '39S' : '37S';
    const pts = net.groups[key].slice(0, 4);
    if (dir === 'c2u')
      $('input').value = pts.map(p => `${p[0]}  ${p[1]}`).join('\n');
    else
      $('input').value = pts.map(p => `${p[2]}  ${p[3]}`).join('\n');
    $('status').innerHTML = 'Sample loaded — press <b>Convert</b>.';
  });

  // ---- accuracy badge helper ----
  function badge(nearestM) {
    if (nearestM == null) return '';
    if (nearestM < 3000) return `<span class="acc-badge acc-good">±&lt;5 m · control ${(nearestM/1000).toFixed(1)} km</span>`;
    if (nearestM < 30000) return `<span class="acc-badge acc-mid">±~10 m · control ${(nearestM/1000).toFixed(1)} km</span>`;
    return `<span class="acc-badge acc-far">projection only · control ${(nearestM/1000).toFixed(0)} km</span>`;
  }

  // ---- main convert ----
  $('runBtn').addEventListener('click', run);
  function run() {
    const useCtrl = $('useCtrl').checked;
    const beltSel = $('belt').value;
    const hemiSel = $('hemi').value;
    const cmFixed = beltSel === 'auto' ? null : parseInt(beltSel, 10);
    const southFixed = hemiSel === 'auto' ? null : (hemiSel === 'S');

    const lines = $('input').value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) { $('status').textContent = 'No input rows.'; $('output').value=''; return; }
    if (lines.length > 5000) { $('status').textContent = 'Please keep batches under 5000 rows.'; return; }

    const out = [];
    const nears = [];
    let ok = 0;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].split(/[\s,;\t]+/);
      if (t.length < 2) { out.push(`row ${i+1}: need two numbers`); continue; }
      const a = parseFloat(t[0]), b = parseFloat(t[1]);
      if (!isFinite(a) || !isFinite(b)) { out.push(`row ${i+1}: invalid number`); continue; }

      try {
        if (dir === 'c2u') {
          let cm = cmFixed, south = southFixed;
          if (cm == null || south == null) {
            const [dcm, dsouth] = CE.detectBeltFromCassini(a, b, net, southFixed);
            cm = cm == null ? dcm : cm;
            south = south == null ? dsouth : south;
          }
          const [e, n, near] = CE.convert(a, b, cm, south, 'c2u', useCtrl ? net : null, useCtrl);
          const epsg = CE.epsgTarget(cm, south);
          out.push(`${e.toFixed(3)}  ${n.toFixed(3)}   [${cm}°${south?'S':'N'} · ${epsg}]`);
          if (near != null) nears.push(near * CE.FT);
          ok++;
        } else {
          let south = southFixed == null ? (b > 5e6) : southFixed;
          let cm = cmFixed;
          if (cm == null) { const [dcm, dsouth] = CE.detectBeltFromUtm(a, b, net); cm = dcm; if (southFixed == null) south = dsouth; }
          const [x, y, near] = CE.convert(a, b, cm, south, 'u2c', useCtrl ? net : null, useCtrl);
          out.push(`${x.toFixed(3)}  ${y.toFixed(3)}   [${cm}°${south?'S':'N'}]`);
          if (near != null) nears.push(near);
          ok++;
        }
      } catch (err) {
        out.push(`row ${i+1}: ${err.message}`);
      }
    }
    $('output').value = out.join('\n');
    if (nears.length) {
      const avg = nears.reduce((x, y) => x + y, 0) / nears.length;
      $('status').innerHTML = `Converted <b>${ok}</b> point(s). &nbsp;${badge(avg)}`;
    } else {
      $('status').innerHTML = `Converted <b>${ok}</b> point(s) — rigorous projection (no control correction).`;
    }
  }

  // ---- copy output ----
  $('copyOut').addEventListener('click', () => {
    const v = $('output').value; if (!v) return;
    navigator.clipboard?.writeText(v);
    $('copyOut').textContent = 'Copied ✓';
    setTimeout(() => $('copyOut').textContent = 'Copy output', 1400);
  });

  // ---- PROJ string ----
  function updateProj() {
    const cm = parseInt($('projCm').value, 10);
    $('projText').textContent = CE.proj4String(cm, $('projTowgs').checked);
  }
  $('projCm').addEventListener('change', updateProj);
  $('projTowgs').addEventListener('change', updateProj);
  $('projCopy').addEventListener('click', () => {
    navigator.clipboard?.writeText($('projText').textContent);
    $('projCopy').textContent = 'Copied ✓';
    setTimeout(() => $('projCopy').textContent = 'Copy', 1400);
  });

  // init
  updateLabels();
  updateProj();
})();
