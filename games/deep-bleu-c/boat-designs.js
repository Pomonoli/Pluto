'use strict';

// One illustrated side profile for each progression level, shared by all views.
const BOAT_DESIGNS = [
  ['Vlot', 'vlot'], ['Kano', 'kano'], ['Roeiboot', 'roeiboot'],
  ['Zeilboot', 'zeilboot'], ['Kustboot', 'kustboot'], ['Langschip', 'langschip'],
  ['Vrachtschip', 'vrachtschip'], ['Oorlogsschip', 'oorlogsschip'],
  ['Drakkar', 'drakkar'], ['Koningsschip', 'koningsschip']
].map(([name, hull], index) => ({ name, hull, tier: index + 1, artwork: `boat-${index + 1}.svg` }));

function renderBoatSvg(tier) {
  const design = BOAT_DESIGNS[tier - 1];
  if (!design) throw new Error('Onbekend bootniveau.');
  const parts = [];
  const path = (d, fill, stroke = '#68543B', width = 1.6) => parts.push(`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`);
  const line = (x1, y1, x2, y2, color = '#68543B', width = 1.5) => parts.push(`<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`);
  const rect = (x, y, w, h, fill, rx = 0) => parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="#786246" stroke-width="1.3"/>`);
  const ellipse = (x, y, rx, ry, fill, stroke = 'none') => parts.push(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>`);
  const flag = (x, y, length = 30) => {
    path(`M${x} ${y}q${length / 2} -5 ${length} 1l-7 5 7 6q-${length / 2} -5 -${length} -1Z`, '#A85D44');
  };
  const sail = (x, top, w, h, color = '#EAE4CC', stripes = false) => {
    line(x, top - 12, x, 153, '#655138', 2.5);
    const left = x - w / 2, right = x + w / 2;
    const d = `M${left} ${top}Q${x + w * 0.22} ${top + h * 0.47} ${left - 6} ${top + h}Q${x} ${top + h + 7} ${right} ${top + h - 3}Q${right + 14} ${top + h * 0.46} ${right - 4} ${top}Z`;
    path(d, color, '#9A957F', 1);
    if (stripes) {
      const clip = `sail-${parts.length}`;
      parts.push(`<defs><clipPath id="${clip}"><path d="${d}"/></clipPath></defs><g clip-path="url(#${clip})">`);
      for (let i = 0; i < 4; i += 1) {
        const sx = left + i * w / 3;
        path(`M${sx} ${top - 2}Q${sx + 24} ${top + h / 2} ${sx - 2} ${top + h + 8}L${sx + 10} ${top + h + 8}Q${sx + 38} ${top + h / 2} ${sx + 12} ${top - 2}Z`, '#A5543F', 'none');
      }
      parts.push('</g>');
    }
    line(left - 5, top - 1, right + 2, top - 1, '#776247', 2.4);
    line(left - 6, top + h, x, 149, '#B5AA8D', 0.9);
    line(right, top + h - 3, x + 38, 147, '#B5AA8D', 0.9);
    path(`M${left + 2} ${top + 2}Q${x - 8} ${top + h * 0.5} ${left} ${top + h - 2}L${left + 10} ${top + h - 1}Q${x + 2} ${top + h * 0.5} ${left + 12} ${top + 2}Z`, '#FFFFFF', 'none');
  };
  const oars = (count, start = 94, spacing = 17) => {
    for (let i = 0; i < count; i += 1) {
      const x = start + i * spacing;
      line(x + 12, 151, x - 10, 185, '#67513B', 3);
      path(`M${x - 9} 178l-8 11q-1 4 4 4l8 -12Z`, '#B99D6F', '#796043', 1);
    }
  };
  const shields = (count, start = 82, spacing = 18) => {
    for (let i = 0; i < count; i += 1) {
      const x = start + i * spacing;
      ellipse(x, 155, 8, 9, i % 2 ? '#B9BB94' : '#7E9472', '#5E654B');
      line(x, 148, x, 162, '#D3C9A8', 0.8);
      ellipse(x, 155, 2, 2, '#C4A875', '#7D6749');
    }
  };
  const dragon = (x, mirror = false) => {
    parts.push(`<g transform="translate(${x} 0) scale(${mirror ? -1 : 1} 1)">`);
    path('M0 153Q17 132 13 112L8 104 12 97 19 102 23 96 28 102 35 103 32 112 22 113Q27 142 8 160Z', '#88714B');
    ellipse(24, 106, 1.5, 1.5, '#2C392F');
    parts.push('</g>');
  };

  parts.push('<g opacity="0.2">');
  ellipse(160, tier <= 2 ? 184 : 194, tier < 3 ? 102 : 121, 5, '#17414F', 'none');
  parts.push('</g>');
  // Rigging is behind the sail and hull, as in the hand-drawn reference.
  if (tier >= 4) {
    const top = tier >= 9 ? 36 : tier === 7 ? 50 : 65;
    line(151, top - 7, 51, 147, '#8F8A72', 1);
    line(151, top - 7, 264, 146, '#8F8A72', 1);
  }
  if (tier === 1) {
    line(164, 95, 164, 161, '#756342', 3);
    path('M168 100L212 115 168 134Z', '#ECE7D2', '#C3BEA5', 1);
    for (let i = 0; i < 8; i += 1) {
      rect(51 + i * 27, 164, 26, 15, i % 2 ? '#AB9068' : '#C0A27A', 2);
      line(55 + i * 27, 167, 72 + i * 27, 167, '#D0B88C', 1);
    }
    line(86, 163, 86, 179, '#665A40', 2);
    line(238, 163, 238, 179, '#665A40', 2);
  } else if (tier === 2) {
    path('M73 155Q157 169 247 153L241 167Q162 186 81 169Z', '#947A54');
    path('M77 154Q160 163 244 152Q229 164 85 161Z', '#C3AC7F', '#826B49');
    line(89, 169, 231, 168, '#67583F');
  } else {
    if (tier === 4) sail(156, 65, 66, 76);
    if (tier === 5) {
      sail(171, 71, 84, 66);
      path('M113 74L111 137 71 137Z', '#E8E1C9', '#A6A18A', 1);
      line(113, 59, 113, 154);
    }
    if (tier === 6) {
      sail(157, 77, 91, 62, '#C9CEAC');
      path('M114 97L201 97 203 111 114 111Z', '#9B5D42', 'none');
    }
    if (tier === 7) {
      sail(166, 57, 60, 80, '#AFBDB0');
      sail(108, 83, 45, 57, '#D8DCCA');
      rect(216, 126, 36, 26, '#A79067');
      rect(222, 115, 27, 12, '#D3C7A4');
    }
    if (tier === 8) {
      line(137, 43, 174, 157, '#67543C', 3);
      path('M140 50L207 139 94 139Z', '#E9E3CE', '#A6A18A');
      line(141, 48, 210, 141, '#67543C', 2);
    }
    if (tier === 9) { sail(153, 44, 104, 95, '#EEE5CC', true); flag(153, 27); }
    if (tier === 10) {
      sail(117, 50, 70, 83, '#EEE5CC', true);
      sail(190, 68, 66, 66, '#EEE5CC', true);
      path('M74 88L72 135 39 133Z', '#E6DCC1', '#9F9376');
      line(74, 72, 74, 151, '#67543C', 2);
      flag(117, 32, 40); flag(190, 51, 31); flag(74, 76, 23);
      rect(44, 124, 43, 28, '#968057');
      rect(48, 113, 34, 12, '#D1BF91');
      for (let i = 0; i < 4; i += 1) rect(49 + i * 9, 128, 5, 9, '#3E4D3E');
    }
    const deep = tier === 7 || tier === 10;
    const left = tier === 3 ? 66 : 43, right = tier === 3 ? 254 : 278;
    path(`M${left} 144Q156 161 ${right} 142L${right - 18} ${deep ? 181 : 170}Q158 ${deep ? 195 : 187} ${left + 17} ${deep ? 177 : 169}Z`, tier === 7 ? '#7B644C' : '#927650');
    path(`M${left + 4} 146Q157 157 ${right - 4} 144L${right - 9} 153Q153 166 ${left + 9} 155Z`, '#C3AA7A');
    path(`M${left + 17} 166Q163 181 ${right - 18} 163`, 'none', '#61523D', 1.5);
    if (deep) path(`M${left + 23} 175Q162 188 ${right - 23} 173`, 'none', '#B6996B', 1.2);
    for (let x = left + 36; x < right - 20; x += 27) line(x, 160, x + 3, deep ? 183 : 174, '#786142', 0.8);
    if (tier === 3) { oars(3, 118, 28); line(108, 148, 131, 148, '#D4BD8E', 4); }
    if (tier === 5) oars(4, 113, 23);
    if (tier === 6) { dragon(259); dragon(60, true); oars(6, 111, 20); shields(8, 92, 19); }
    if (tier >= 8) { dragon(272); dragon(46, true); oars(tier === 10 ? 9 : 8, 97, 18); shields(tier === 10 ? 10 : 9, 76, 18); }
  }
  const viewBox = ['30 85 260 120', '50 140 220 65', '40 130 240 75'][tier - 1] || '15 12 290 193';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${design.name}"><title>${design.name} · niveau ${tier}</title><g>${parts.join('')}</g></svg>`;
}

module.exports = { BOAT_DESIGNS, renderBoatSvg };
