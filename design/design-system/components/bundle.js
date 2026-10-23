/* @ds-bundle: {"format":4,"namespace":"Minifia","components":[{"name":"Button"},{"name":"Chip"},{"name":"TextField"},{"name":"Timer"},{"name":"PhaseBar"},{"name":"Notice"},{"name":"ReconnectBanner"},{"name":"ConfirmSheet"},{"name":"RoleCard"},{"name":"MyRoleButton"},{"name":"Figure"},{"name":"Table"},{"name":"Backdrop"},{"name":"EmojiBar"},{"name":"QuickMessagePanel"},{"name":"MessageLog"},{"name":"VerdictPicker"},{"name":"Announcement"},{"name":"ResultList"},{"name":"Icon"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }

  /* ---------- 그림 파일 위치 ----------
     번들을 <script src> 로 불러오면 그 옆 assets/ 를 쓴다(캔버스 설치본·앱). 못 찾으면 디자인 시스템 업로드본을 쓴다.
     파일은 저장소 public/characters/, public/backgrounds/ 와 같다. */
  var ASSET_BASE = (function () {
    var el = document.currentScript || document.querySelector('script[src*="components/bundle.js"]');
    var m = el && el.src && el.src.match(/^(.*\/)components\/bundle\.js(\?.*)?$/);
    return m ? m[1] + 'assets/' : null;
  })();
  var ASSET_BLOBS = {
    'characters/table/fig1_boy_brown_default@4x.png': '/_blob/d72b0596b706fdc33a59668be91012e1',
    'characters/table/fig2_boy_black_default@4x.png': '/_blob/ff851a498b24683d8e099e29bdbf122a',
    'characters/table/fig3_boy_blonde_default@4x.png': '/_blob/bed2517334884b6a311b4820baa0d040',
    'characters/table/fig4_girl_brown_default@4x.png': '/_blob/81ddff0a6ddba2017addfa764e1eef4e',
    'characters/table/fig5_girl_black_default@4x.png': '/_blob/67f305c22eb662a91e94572204ee6b26',
    'characters/table/fig6_girl_auburn_default@4x.png': '/_blob/5134bb51aab831c7e467c7a4d5a28487',
    'characters/table/fig7_boy_blackhat_default@4x.png': '/_blob/1b308ef208feee9fb86f8804f7ffd369',
    'characters/table/fig8_girl_tanhat_default@4x.png': '/_blob/cc50e2ff1038d3715ab21e934d72839a',
    'characters/roles/mafia_default@4x.png': '/_blob/5eb4f2c73ef4163f930ac2c30bfaf920',
    'characters/roles/police_default@4x.png': '/_blob/74667d107d385aeec956c14b653d16d6',
    'characters/roles/doctor_default@4x.png': '/_blob/c705093934972fe43e48c8b3c2bc4894',
    'characters/roles/citizen_default@4x.png': '/_blob/1cff16e1a064dde88ad859fe60f01bd2',
    'characters/ghost/ghost_default@4x.png': '/_blob/50557fd2c98a76b4d5ffed74aa3a8ac3',
    'backgrounds/bg_game_lobby.svg': '/_blob/d12a14742509df1164e84d402d427ba0',
    'backgrounds/bg_game_night.svg': '/_blob/dddc67abad905872f6446291c7fa1a1b',
    'backgrounds/bg_game_day.svg': '/_blob/8b26630d8967bfcc65ae27f29c3bbdeb',
    'backgrounds/bg_game_verdict.svg': '/_blob/0b64eb4764f579fe343d7048af83d7b3',
    'backgrounds/bg_entry_lobby.svg': '/_blob/8bc4b924af6747bdfc94111ebea3d303',
    'backgrounds/bg_entry_night.svg': '/_blob/ce82a4421323c6350b7b5a61650d30d6',
    'backgrounds/bg_entry_day.svg': '/_blob/3230d271f453dedeef2e141398fc8be1',
    'backgrounds/bg_entry_verdict.svg': '/_blob/27b3a1db6657d008df302cd4ad8214f1'
  };
  function asset(path) { return ASSET_BASE ? ASSET_BASE + path : ASSET_BLOBS[path]; }

  /* ---------- Icon: 인라인 SVG. 이모지·아이콘 폰트 대신 쓴다 ---------- */
  var ICONS = {
    crown: [['path', { d: 'M4 18h16M5 18 4 8l5 4 3-6 3 6 5-4-1 10' }]],
    diamond: [['path', { d: 'M12 3 20 12 12 21 4 12z', fill: 'currentColor', stroke: 'none' }]],
    disconnected: [['path', { d: 'M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 8.5-2.6M9 15.5a5 5 0 0 1 4.5-.9M3 3l18 18' }], ['circle', { cx: 12, cy: 19.5, r: 1, fill: 'currentColor' }]],
    mafia: [['path', { d: 'M2 16.5c4 2.5 16 2.5 20 0M6 15.5C6 10 8 6.5 12 6.5s6 3.5 6 9M6.4 12.5h11.2' }]],
    police: [['path', { d: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z' }], ['path', { d: 'M12 8.2l1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 14.2l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z', fill: 'currentColor', stroke: 'none' }]],
    doctor: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 7.5v9M7.5 12h9' }]],
    citizen: [['circle', { cx: 12, cy: 7.5, r: 4 }], ['path', { d: 'M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5' }]],
    share: [['path', { d: 'M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6' }]],
    check: [['path', { d: 'M5 12.5l4.5 4.5L19 7.5' }]],
    close: [['path', { d: 'M6 6l12 12M18 6 6 18' }]],
    abstain: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M6 18 18 6' }]],
    eye: [['path', { d: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z' }], ['circle', { cx: 12, cy: 12, r: 3 }]],
    moon: [['path', { d: 'M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z' }]],
    sun: [['circle', { cx: 12, cy: 12, r: 4 }], ['path', { d: 'M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8' }]],
    lock: [['rect', { x: 5, y: 11, width: 14, height: 10, rx: 2 }], ['path', { d: 'M8 11V8a4 4 0 0 1 8 0v3' }]],
    'react-q': [['path', { d: 'M9 9a3 3 0 1 1 4.2 2.8c-.8.3-1.2 1-1.2 1.8V15' }], ['circle', { cx: 12, cy: 19, r: 1.2, fill: 'currentColor', stroke: 'none' }]],
    'react-bang': [['path', { d: 'M12 4.5v10' }], ['circle', { cx: 12, cy: 19, r: 1.2, fill: 'currentColor', stroke: 'none' }]],
    'react-sigh': [['circle', { cx: 6, cy: 12, r: 1.4, fill: 'currentColor', stroke: 'none' }], ['circle', { cx: 12, cy: 12, r: 1.4, fill: 'currentColor', stroke: 'none' }], ['circle', { cx: 18, cy: 12, r: 1.4, fill: 'currentColor', stroke: 'none' }]],
    'react-lol': [['path', { d: 'M5 6h8v12M5 12h8M15 6h4v12M15 12h4' }]],
    'react-eyes': [['ellipse', { cx: 8, cy: 12, rx: 3.5, ry: 5 }], ['ellipse', { cx: 16, cy: 12, rx: 3.5, ry: 5 }], ['circle', { cx: 9.5, cy: 13, r: 1.4, fill: 'currentColor', stroke: 'none' }], ['circle', { cx: 17.5, cy: 13, r: 1.4, fill: 'currentColor', stroke: 'none' }]],
    'react-sweat': [['path', { d: 'M12 3.5s6 6.8 6 10.7a6 6 0 0 1-12 0c0-3.9 6-10.7 6-10.7z' }]],
    'react-heart': [['path', { d: 'M12 20s-8-5-8-10.8a4.4 4.4 0 0 1 8-2.6 4.4 4.4 0 0 1 8 2.6C20 15 12 20 12 20z' }]],
    'react-angry': [['path', { d: 'M13 2.5 5.5 13H11l-1 8.5L18.5 11H13z' }]]
  };
  var REACTIONS = [
    { name: 'react-eyes', label: '의심' }, { name: 'react-bang', label: '놀람' }, { name: 'react-q', label: '물음' },
    { name: 'react-lol', label: '웃음' }, { name: 'react-sigh', label: '한숨' }, { name: 'react-sweat', label: '당황' },
    { name: 'react-heart', label: '믿음' }, { name: 'react-angry', label: '화남' }
  ];
  function Icon(p) {
    var parts = ICONS[p.name] || [];
    var size = p.size || 24;
    return h('svg', {
      className: cx('mf-icon', p.className), viewBox: '0 0 24 24', width: size, height: size,
      fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      role: p.label ? 'img' : undefined, 'aria-label': p.label, 'aria-hidden': p.label ? undefined : 'true', style: p.style
    }, parts.map(function (part, i) { return h(part[0], Object.assign({ key: i }, part[1])); }));
  }

  /* ---------- 역할 ---------- */
  var ROLES = {
    mafia: { name: '마피아', desc: '밤마다 동료와 함께 한 명을 지목합니다. 정체를 들키지 마세요.' },
    police: { name: '경찰', desc: '밤마다 한 명을 조사해 마피아인지 알아냅니다.' },
    doctor: { name: '의사', desc: '밤마다 한 명을 골라 마피아의 공격에서 지킵니다. 자신도 고를 수 있어요.' },
    citizen: { name: '시민', desc: '능력은 없지만 토론과 투표로 마피아를 찾아내세요.' }
  };

  /* ---------- Button ---------- */
  function Button(p) {
    var variant = p.variant || 'primary';
    var rest = Object.assign({}, p); delete rest.variant; delete rest.block; delete rest.icon; delete rest.compact;
    return h('button', Object.assign({ type: 'button' }, rest, {
      className: cx('mf-btn', 'mf-btn--' + variant, p.block && 'mf-btn--block', p.compact && 'mf-btn--compact', p.className)
    }), p.icon ? h(Icon, { name: p.icon, size: 20 }) : null, p.children);
  }

  /* ---------- Chip ---------- */
  function Chip(p) {
    return h('button', {
      type: 'button', className: cx('mf-chip', p.className), 'aria-pressed': p.selected ? 'true' : 'false',
      disabled: p.disabled, onClick: p.onClick
    }, p.icon ? h(Icon, { name: p.icon }) : null, p.children);
  }

  /* ---------- TextField ---------- */
  function TextField(p) {
    var id = p.id || ('mf-f-' + (p.label || 'x'));
    return h('div', { className: cx('mf-field', p.error && 'mf-field--error', p.className) },
      p.label ? h('label', { className: 'mf-field__label', htmlFor: id }, p.label) : null,
      h('input', {
        id: id, className: cx('mf-field__input', p.code && 'mf-field__input--code'),
        defaultValue: p.value, placeholder: p.placeholder, inputMode: p.code ? 'numeric' : undefined,
        maxLength: p.code ? 4 : 8, autoComplete: 'off', spellCheck: false, 'aria-invalid': p.error ? 'true' : undefined,
        'aria-describedby': p.error ? id + '-err' : undefined
      }),
      p.error ? h('p', { className: 'mf-field__error', id: id + '-err', role: 'alert' }, p.error) : null);
  }

  /* ---------- Timer ---------- */
  function Timer(p) {
    var dur = p.durationMs || 15000;
    var rem = Math.max(0, Math.min(dur, p.remainingMs == null ? dur : p.remainingMs));
    var sec = Math.ceil(rem / 1000);
    var urgent = rem > 0 && rem <= 5000;
    return h('div', { className: cx('mf-timer', urgent && 'mf-timer--urgent', p.className), role: 'timer', 'aria-label': '남은 시간 ' + sec + '초' },
      h('div', { className: 'mf-timer__track' }, h('div', { className: 'mf-timer__fill', style: { transform: 'scaleX(' + (rem / dur) + ')' } })),
      h('span', { className: 'mf-timer__num', 'aria-hidden': 'true' }, sec));
  }

  /* ---------- PhaseBar: 단계 이름 + 지금 할 일 한 문장 + 타이머 (UX-01) ---------- */
  function PhaseBar(p) {
    return h('div', { className: cx('mf-phasebar', p.className) },
      h('div', { className: 'mf-phasebar__row' },
        h('span', { className: 'mf-phasebar__phase' }, p.phase),
        p.extra || null),
      h('p', { className: 'mf-phasebar__do' }, p.instruction),
      p.durationMs ? h(Timer, { remainingMs: p.remainingMs, durationMs: p.durationMs }) : null);
  }

  /* ---------- Notice ---------- */
  function Notice(p) {
    return h('div', { className: cx('mf-notice', p.tone === 'private' && 'mf-notice--private', p.className), role: 'status' },
      p.icon ? h(Icon, { name: p.icon }) : null, h('span', null, p.children));
  }

  /* ---------- ReconnectBanner ---------- */
  function ReconnectBanner(p) {
    return h('div', { className: cx('mf-reconnect', p.className), role: 'status' },
      h('span', { className: 'mf-reconnect__dot', 'aria-hidden': 'true' }), p.text || '다시 연결하는 중…');
  }

  /* ---------- ConfirmSheet: 취소가 눈에 띄고 파괴 동작은 보조 스타일 ---------- */
  function ConfirmSheet(p) {
    return h('div', { className: cx('mf-sheet-wrap', p.overlay && 'mf-sheet-wrap--overlay') },
      h('div', { className: 'mf-sheet-scrim', onClick: p.onCancel }),
      h('div', { className: 'mf-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': p.title },
        h('h2', { className: 'mf-t-heading' }, p.title),
        p.body ? h('p', { className: 'mf-t-body mf-t-muted' }, p.body) : null,
        h('div', { className: 'mf-sheet__actions' },
          h(Button, { variant: 'primary', block: true, onClick: p.onCancel }, p.cancelLabel || '취소'),
          h(Button, { variant: 'secondary', block: true, onClick: p.onConfirm }, p.confirmLabel))));
  }

  /* ---------- RoleCard ---------- */
  function Diamond() {
    return h('svg', { className: 'mf-card__diamond', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
      h('path', { d: 'M50 4 96 50 50 96 4 50z', fill: 'none', stroke: 'var(--gray-500)', strokeWidth: 2 }),
      h('path', { d: 'M50 18 82 50 50 82 18 50z', fill: 'var(--crimson-500)' }),
      h('path', { d: 'M50 34 66 50 50 66 34 50z', fill: 'var(--night-800)' }));
  }
  function RoleCard(p) {
    var face = p.face || 'back';
    var role = p.role ? ROLES[p.role] : null;
    var mates = p.mates || [];
    return h('div', { className: cx('mf-card', face === 'front' && role && 'mf-card--front', p.role === 'mafia' && 'mf-card--mafia', p.className), style: p.style },
      h('div', { className: 'mf-card__inner' },
        h('div', { className: 'mf-card__face mf-card__back', role: 'button', tabIndex: 0, 'aria-label': '역할 카드 뒤집기', onClick: p.onFlip },
          h(Diamond), h('span', { className: 'mf-card__hint' }, '눌러서 확인')),
        role ? h('div', { className: 'mf-card__face mf-card__front', 'aria-hidden': face !== 'front' ? 'true' : undefined },
          h('img', { className: 'mf-card__art', src: ROLE_ART[p.role], width: 72, height: 96, alt: '', draggable: false }),
          h('p', { className: 'mf-t-display' }, role.name),
          h('p', { className: 'mf-card__desc' }, role.desc),
          p.role === 'mafia' ? h('p', { className: 'mf-card__mates' }, mates.length ? '동료: ' + mates.join(', ') : '이번 판 마피아는 당신 혼자입니다') : null) : null));
  }

  /* ---------- MyRoleButton ---------- */
  function MyRoleButton(p) {
    return h('div', { className: cx('mf-myrole', p.className) },
      h(Button, { variant: 'secondary', block: true, 'aria-pressed': p.held ? 'true' : 'false' }, '내 역할'),
      h('p', { className: 'mf-myrole__hint' }, p.hint || '누르고 있는 동안만 보여요'));
  }

  /* ---------- Figure: 캐릭터 그림 (세트 C, 72x96, 원본 design/characters/table) ---------- */
  var SEAT_COLORS = ['var(--seat-1)', 'var(--seat-2)', 'var(--seat-3)', 'var(--seat-4)', 'var(--seat-5)', 'var(--seat-6)', 'var(--seat-7)', 'var(--seat-8)'];
  var FIGURE_IDS = ['fig1_boy_brown', 'fig2_boy_black', 'fig3_boy_blonde', 'fig4_girl_brown', 'fig5_girl_black', 'fig6_girl_auburn', 'fig7_boy_blackhat', 'fig8_girl_tanhat'];
  var ROLE_ART = {};
  ['mafia', 'police', 'doctor', 'citizen'].forEach(function (r) { ROLE_ART[r] = asset('characters/roles/' + r + '_default@4x.png'); });
  var FIGURE_NAMES = ['소년 갈색', '소년 검정', '소년 금발', '소녀 갈색', '소녀 검정', '소녀 적갈색', '소년 검은 중절모', '소녀 갈색 중절모'];
  function Figure(p) {
    var v = ((p.variant || 0) % 8 + 8) % 8;
    var state = p.state || 'default';
    /* 탈락하면 유령 하나로 바뀐다(자리별 유령 없음). 끊김은 흑백 + 60% */
    return h('img', {
      className: cx('mf-figure', state !== 'default' && 'mf-figure--' + state, p.className),
      src: asset(state === 'dead' ? 'characters/ghost/ghost_default@4x.png' : 'characters/table/' + FIGURE_IDS[v] + '_default@4x.png'), width: 72, height: 96, draggable: false,
      alt: p.label || '', 'aria-hidden': p.label ? undefined : 'true'
    });
  }

  /* ---------- Backdrop: 화면 뒤 배경 장면 (A_cute, 원본 design/backgrounds/, 앱은 public/backgrounds/) ---------- */
  function Backdrop(p) {
    var layout = p.layout === 'entry' ? 'entry' : 'game';
    var variant = ['lobby', 'night', 'day', 'verdict'].indexOf(p.variant) >= 0 ? p.variant : 'lobby';
    /* 1080x2340 그림을 cover 로 채운다. 기준은 가운데 위쪽 */
    var bg = { backgroundImage: 'url("' + asset('backgrounds/bg_' + layout + '_' + variant + '.svg') + '")', backgroundPosition: p.position || 'center top' };
    return h('div', { className: cx('mf-backdrop', 'mf-backdrop--' + variant, p.className), style: Object.assign({}, p.style) },
      h('div', { className: 'mf-backdrop__art', style: bg, 'aria-hidden': 'true' }),
      p.children ? h('div', { className: 'mf-backdrop__content' }, p.children) : null);
  }

  /* ---------- Table: 2.5D 원근 타원 테이블과 8자리 ---------- */
  function seatLayout(seat, mySeat, total) {
    total = total || 8;
    var slot = (((seat - mySeat) % total) + total) % total;
    var theta = Math.PI / 2 + (slot / total) * Math.PI * 2;
    var depth = (Math.sin(theta) + 1) / 2;
    return { slot: slot, x: 50 + 40 * Math.cos(theta), y: 50 + 22 * Math.sin(theta), scale: 0.62 + 0.38 * depth, z: Math.round(depth * 10), depth: depth };
  }
  var FIG_H = 21.33; /* 인물 높이: 장면 높이 대비 % (72x96, 자리 폭 20%, 장면 4:5) */
  function Chair() {
    return h('svg', { viewBox: '0 0 40 48', 'aria-hidden': 'true' },
      h('path', { d: 'M8 46V20Q8 6 20 6Q32 6 32 20V46', fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round' }),
      h('path', { d: 'M4 34H36', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round' }));
  }
  function Table(p) {
    var seats = p.seats || [];
    var mySeat = p.mySeat || 0;
    var layers = [];
    var top = [];
    for (var i = 0; i < 8; i++) {
      var s = seats[i];
      var L = seatLayout(i, mySeat);
      if (!s) {
        layers.push(h('div', { key: 'c' + i, className: 'mf-chair', style: { left: L.x + '%', top: L.y + '%', zIndex: L.z, transform: 'translate(-50%,-100%) scale(' + L.scale + ')' } }, h(Chair)));
        continue;
      }
      var headTop = L.y - FIG_H * L.scale;
      var front = L.depth >= 0.5;
      var state = s.state || 'default';
      var ring = s.selected ? 'selected' : s.selectable ? 'selectable' : s.mate ? 'mate' : s.me ? 'me' : null;
      var seatLabel = s.name + (s.me ? ' (나)' : '') + (state === 'disconnected' ? ', 연결 끊김' : '') + (state === 'dead' ? ', 탈락' : '');
      layers.push(h('div', { key: 's' + i, className: 'mf-seat', style: { left: L.x + '%', top: L.y + '%', zIndex: L.z, transform: 'translate(-50%,-100%) scale(' + L.scale + ')' } },
        s.candidate ? h('div', { className: 'mf-seat__spot' }) : null,
        ring ? h('div', { className: 'mf-seat__ring mf-seat__ring--' + ring }) : null,
        s.mate && ring !== 'mate' ? h('div', { className: 'mf-seat__ring mf-seat__ring--mate' }) : null,
        h(Figure, { variant: s.variant != null ? s.variant : i, state: state }),
        s.host ? h(Icon, { name: 'crown', className: 'mf-seat__mark mf-seat__mark--host', label: '방장' }) : null,
        s.mate ? h(Icon, { name: 'diamond', className: 'mf-seat__mark mf-seat__mark--mate', label: '동료' }) : null,
        s.selectable || s.pressable ? h('button', { type: 'button', className: 'mf-seat__btn', 'aria-label': seatLabel, 'aria-pressed': s.selectable ? (s.selected ? 'true' : 'false') : undefined, onClick: p.onSeatPress ? function (idx) { return function () { p.onSeatPress(idx); }; }(i) : undefined }) : null));
      var tagTop = front ? L.y + 1.2 : headTop - 7.5;
      top.push(h('div', { key: 't' + i, className: cx('mf-tag', !front && 'mf-tag--back', state === 'dead' && 'mf-tag--dead'), style: { left: L.x + '%', top: tagTop + '%' }, title: s.name },
        h('span', { className: 'mf-tag__name' },
          h('i', { className: 'mf-tag__dot', style: { background: SEAT_COLORS[(s.variant != null ? s.variant : i) % 8] }, 'aria-hidden': 'true' }),
          h('span', null, s.name + (s.me ? ' (나)' : '')),
          state === 'disconnected' ? h(Icon, { name: 'disconnected', className: 'mf-tag__off', label: '연결 끊김' }) : null),
        s.claim ? h('span', { className: 'mf-tag__claim' }, h('b', null, s.claim), s.changed ? h('span', { className: 'mf-tag__changed' }, '· 말 바꿈') : null) : null,
        state === 'dead' ? h('span', { className: 'mf-tag__status' }, '탈락') : null));
      if (s.bubble || s.reaction) {
        top.push(h('div', { key: 'f' + i, className: 'mf-float', style: { left: L.x + '%', top: (headTop - (front ? 1 : 8)) + '%' } },
          s.bubble ? h('div', { className: 'mf-bubble' }, s.bubble) : h('div', { className: 'mf-react' }, h(Icon, { name: s.reaction, label: s.reactionLabel }))));
      }
      if (s.votes) {
        top.push(h('div', { key: 'v' + i, className: 'mf-votes', style: { left: (L.x + 7 * L.scale) + '%', top: (L.y - 2) + '%' }, 'aria-label': s.votes + '표' }, s.votes));
      }
    }
    return h('div', { className: cx('mf-root mf-table', p.bare && 'mf-table--bare', p.className), style: p.style, role: 'group', 'aria-label': p.label || '테이블' },
      p.morning ? h('div', { className: 'mf-table__morning' }) : null,
      h('div', { className: 'mf-table__moon' }),
      h('div', { className: 'mf-table__shadow' }),
      h('div', { className: 'mf-table__top' }),
      p.center ? h('div', { className: 'mf-table__center' }, p.center) : null,
      layers,
      p.dimmed ? h('div', { className: 'mf-table__scrim' }) : null,
      top);
  }

  /* ---------- EmojiBar: 반응 8종 (OS 이모지 대신 SVG) ---------- */
  function EmojiBar(p) {
    return h('div', { className: cx('mf-emojibar', p.className), role: 'group', 'aria-label': '반응 보내기' },
      REACTIONS.map(function (r) { return h('button', { key: r.name, type: 'button', disabled: p.disabled, 'aria-label': r.label }, h(Icon, { name: r.name })); }));
  }

  /* ---------- QuickMessagePanel: 템플릿 → 빈칸 고르기 → 보내기 ---------- */
  function QuickMessagePanel(p) {
    var templates = p.templates || [];
    var options = p.options || [];
    return h('div', { className: cx('mf-qm', p.className) },
      h('div', { className: 'mf-qm__row', role: 'group', 'aria-label': '메시지 고르기' },
        templates.map(function (t, i) { return h(Chip, { key: i, selected: i === p.active }, t); })),
      options.length ? h('div', { className: 'mf-qm__row', role: 'group', 'aria-label': '빈칸 고르기' },
        options.map(function (o, i) { return h(Chip, { key: i, selected: o === p.picked }, o); })) : null,
      h('div', { className: 'mf-qm__preview' },
        h('div', { className: 'mf-qm__text' }, p.preview ? p.preview : h('span', { className: 'mf-qm__empty' }, '보낼 말을 고르세요')),
        h(Button, { variant: 'primary', compact: true, disabled: !p.ready, 'aria-label': '보내기' }, '보내기')));
  }

  /* ---------- MessageLog ---------- */
  function MessageLog(p) {
    return h('ul', { className: cx('mf-log', p.className), 'aria-label': '최근 메시지' },
      (p.items || []).map(function (m, i) {
        return h('li', { key: i },
          h('b', null, h('i', { className: 'mf-tag__dot', style: { background: SEAT_COLORS[(m.variant || 0) % 8] }, 'aria-hidden': 'true' }), m.from),
          h('span', null, m.text));
      }));
  }

  /* ---------- VerdictPicker: 찬반 투표 ---------- */
  function VerdictPicker(p) {
    return h('div', { className: cx('mf-verdict', p.className), role: 'group', 'aria-label': (p.target || '후보') + ' 처형 찬반' },
      h('button', { type: 'button', 'aria-pressed': p.value === 'yes' ? 'true' : 'false' }, h(Icon, { name: 'check' }), '찬성'),
      h('button', { type: 'button', 'aria-pressed': p.value === 'no' ? 'true' : 'false' }, h(Icon, { name: 'close' }), '반대'));
  }

  /* ---------- Announcement: 단계 발표 ---------- */
  function Announcement(p) {
    var tone = p.tone || 'neutral';
    return h('div', { className: cx('mf-announce', 'mf-announce--' + tone, p.className), role: 'status' },
      tone === 'danger' ? h('span', { className: 'mf-announce__line', style: { top: '14%' } }) : null,
      p.icon ? h(Icon, { name: p.icon, size: 40, style: { color: tone === 'danger' ? 'var(--crimson-400)' : 'var(--gray-100)' } }) : null,
      h('p', { className: 'mf-t-display' }, p.title),
      p.sub ? h('p', { className: 'mf-announce__sub' }, p.sub) : null,
      tone === 'danger' ? h('span', { className: 'mf-announce__line', style: { bottom: '14%' } }) : null);
  }

  /* ---------- ResultList: 게임 끝, 모든 역할 공개 ---------- */
  function ResultList(p) {
    return h('ul', { className: cx('mf-result', p.className) },
      (p.players || []).map(function (pl, i) {
        var r = ROLES[pl.role];
        return h('li', { key: i, className: pl.dead ? 'is-dead' : undefined },
          h('div', { className: 'mf-result__fig' }, h(Figure, { variant: pl.variant != null ? pl.variant : i, state: pl.dead ? 'dead' : 'default' })),
          h('span', { className: 'mf-result__name' }, pl.name, pl.me ? h('small', null, ' (나)') : null),
          h('span', { className: cx('mf-result__role', pl.role === 'mafia' && 'mf-result__role--mafia') }, h(Icon, { name: pl.role }), r ? r.name : ''));
      }));
  }

  window.Minifia = Object.assign(window.Minifia || {}, {
    Button: Button, Chip: Chip, TextField: TextField, Timer: Timer, PhaseBar: PhaseBar, Notice: Notice,
    ReconnectBanner: ReconnectBanner, ConfirmSheet: ConfirmSheet, RoleCard: RoleCard, MyRoleButton: MyRoleButton,
    Figure: Figure, Table: Table, Backdrop: Backdrop, EmojiBar: EmojiBar, QuickMessagePanel: QuickMessagePanel, MessageLog: MessageLog,
    VerdictPicker: VerdictPicker, Announcement: Announcement, ResultList: ResultList, Icon: Icon,
    seatLayout: seatLayout, ROLES: ROLES, REACTIONS: REACTIONS, ROLE_ART: ROLE_ART, FIGURE_IDS: FIGURE_IDS, FIGURE_NAMES: FIGURE_NAMES, asset: asset
  });
})();
