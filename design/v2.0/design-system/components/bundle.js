/* @ds-bundle: {"format":4,"namespace":"MinifiaV2","components":[{"name":"Icon"},{"name":"PhaseHeader"},{"name":"DotProgress"},{"name":"NameTag"},{"name":"VoteBadge"},{"name":"SureStamp"},{"name":"HeadStack"},{"name":"TopToast"},{"name":"ChatPanel"},{"name":"DressSheet"},{"name":"RoleCard"},{"name":"VerdictPicker"},{"name":"RoleChip"},{"name":"FaceList"},{"name":"WillSheet"}]} */
/* minifia v2.0 게임 겹침 부품. 3D 장면(three.js) 위 DOM 층과 아래 패널에 쓴다. React 18 은 쓰는 쪽이 준다.
 * 결정 0051: 글은 최소로, 보고 누르는 조작 중심. 버튼은 아이콘 + 한두 단어, 진행은 링·점으로 */
(function () {
  var React = window.React, h = React.createElement;
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }

  // ---------- 아이콘: 24 격자, 선 2px, 둥근 끝, currentColor ----------
  var ICONS = {
    // 감정표현 9종(캐릭터 동작과 같은 순서)
    throat: [['c', 12, 7, 4], ['p', 'M4 14.5h16'], ['p', 'M17 12l3 2.5-3 2.5'], ['p', 'M8 19c1.2.8 2.6 1.2 4 1.2s2.8-.4 4-1.2']],
    deny: [['p', 'M8 13V6.5a1.5 1.5 0 0 1 3 0V11'], ['p', 'M11 10.5V5a1.5 1.5 0 0 1 3 0v5.5'], ['p', 'M14 10.5V7a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-6 6h-.5a5 5 0 0 1-4.2-2.3L4.4 14.6a1.5 1.5 0 0 1 2.5-1.7L8 14.5'], ['p', 'M3 4.5l1.8 1.2'], ['p', 'M20 4.5l-1.8 1.2']],
    clap: [['p', 'M7.5 20.5L5 12a2 2 0 0 1 3.8-1.1L11 16'], ['p', 'M16.5 20.5L19 12a2 2 0 0 0-3.8-1.1L13 16'], ['p', 'M12 3v3'], ['p', 'M7.5 4.5l1.4 2'], ['p', 'M16.5 4.5l-1.4 2']],
    cry: [['c', 12, 12, 9], ['p', 'M7.5 10.5c.8-.7 1.7-.7 2.5 0'], ['p', 'M14 10.5c.8-.7 1.7-.7 2.5 0'], ['p', 'M9.8 17c1.4-1.1 3-1.1 4.4 0'], ['p', 'M8.8 13.2c0 1.1-.8 1.8-.8 1.8s-.8-.7-.8-1.8a.8.8 0 0 1 1.6 0z', true]],
    handshake: [['p', 'M2.5 11l3.5-3.5 4.5 2 2.5-1.5 2.5 1.5 4.5-2L21.5 11'], ['p', 'M6 10.5l5.5 5.5a1.6 1.6 0 0 0 2.3 0l3.7-3.7'], ['p', 'M9.5 14l2 2'], ['p', 'M11.5 12l2.5 2.5']],
    point: [['p', 'M3 9.5h11.5a1.5 1.5 0 0 1 0 3H12'], ['p', 'M12 12.5h.5a1.5 1.5 0 0 1 0 3H11'], ['p', 'M11 15.5a1.5 1.5 0 0 1 0 3H8.5A4.5 4.5 0 0 1 4 14v-2.2A2.3 2.3 0 0 1 6.3 9.5'], ['p', 'M18.5 11h3']],
    praise: [['p', 'M7 10.5V20H4v-9.5z'], ['p', 'M7 10.5l4-7a2 2 0 0 1 3.4 1.9L13.5 9h5.2a2 2 0 0 1 2 2.4l-1.3 6.9a2 2 0 0 1-2 1.7H7']],
    surprise: [['c', 12, 12, 9], ['c', 9, 9.5, 1.2, true], ['c', 15, 9.5, 1.2, true], ['c', 12, 15.5, 2.2]],
    dance: [['p', 'M9 18V5.5l11-2V16'], ['c', 6, 18, 3], ['c', 17, 16, 3]],
    // 화면 아이콘
    face: [['c', 12, 12, 9], ['c', 9, 10, 1.1, true], ['c', 15, 10, 1.1, true], ['p', 'M8.5 14.3c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8']],
    hanger: [['p', 'M10 6.5a2 2 0 1 1 2.6 1.9c-.4.1-.6.5-.6.9V11'], ['p', 'M12 11l-8.6 6.2a1 1 0 0 0 .6 1.8h16a1 1 0 0 0 .6-1.8z']],
    map: [['p', 'M9 4.5l-6 2v13l6-2 6 2 6-2v-13l-6 2z'], ['p', 'M9 4.5v13'], ['p', 'M15 6.5v13']],
    skip: [['p', 'M4 6.5l7 5.5-7 5.5z'], ['p', 'M13 6.5l7 5.5-7 5.5z']],
    check: [['p', 'M5 12.5l4.5 4.5L19 7.5']],
    send: [['p', 'M4 12l16-8-6 16-3-7z'], ['p', 'M11 13l9-9']],
    close: [['p', 'M6 6l12 12'], ['p', 'M18 6L6 18']],
    play: [['p', 'M7.5 5l11 7-11 7z']],
    question: [['p', 'M9.2 9a2.8 2.8 0 1 1 3.9 2.6c-.7.3-1.1.9-1.1 1.6v.6'], ['c', 12, 17.2, 0.9, true]],
    thumbUp: [['p', 'M7 10.5V20H4v-9.5z'], ['p', 'M7 10.5l4-7a2 2 0 0 1 3.4 1.9L13.5 9h5.2a2 2 0 0 1 2 2.4l-1.3 6.9a2 2 0 0 1-2 1.7H7']],
    thumbDown: [['p', 'M7 13.5V4H4v9.5z'], ['p', 'M7 13.5l4 7a2 2 0 0 0 3.4-1.9L13.5 15h5.2a2 2 0 0 0 2-2.4l-1.3-6.9A2 2 0 0 0 17.4 4H7']],
    // 밤·아침·유령
    quill: [['p', 'M20 4c-6.5 1-11 5.5-13 11.5L5.5 20'], ['p', 'M20 4c.6 5.5-3.5 10-9.5 11.5'], ['p', 'M9.5 15L6.8 12.3']],
    note: [['p', 'M6 3h9l4 4v14H6z'], ['p', 'M15 3v4h4'], ['p', 'M9 12h7'], ['p', 'M9 16h5']],
    target: [['c', 12, 12, 8], ['c', 12, 12, 3], ['p', 'M12 1.5v3.5'], ['p', 'M12 19v3.5'], ['p', 'M1.5 12H5'], ['p', 'M19 12h3.5']],
    ghost: [['p', 'M5 21V11a7 7 0 0 1 14 0v10l-2.3-1.6L14.3 21 12 19.4 9.7 21l-2.4-1.6z'], ['c', 9.5, 11, 1.2, true], ['c', 14.5, 11, 1.2, true]],
    eye: [['p', 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z'], ['c', 12, 12, 3]],
    heal: [['p', 'M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z']],
    roleMafia: [['p', 'M3.5 15.5c3 1.4 14 1.4 17 0'], ['p', 'M6.5 15V9.5C6.5 6.9 9 5 12 5s5.5 1.9 5.5 4.5V15'], ['p', 'M6.5 12.5h11']],
    rolePolice: [['p', 'M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6z'], ['p', 'M12 8.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 14.5l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z', true]],
    roleDoctor: [['c', 12, 12, 9], ['p', 'M12 7.5v9'], ['p', 'M7.5 12h9']],
    roleCitizen: [['c', 12, 8, 3.5], ['p', 'M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6']]
  };
  function Icon(p) {
    var spec = ICONS[p.name] || [], size = p.size || 24;
    return h('svg', { className: cx('mv-icon', p.className), width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      role: p.label ? 'img' : undefined, 'aria-label': p.label || undefined, 'aria-hidden': p.label ? undefined : 'true', focusable: 'false' },
      spec.map(function (s, i) {
        return s[0] === 'c' ? h('circle', { key: i, cx: s[1], cy: s[2], r: s[3], fill: s[4] ? 'currentColor' : 'none', stroke: s[4] ? 'none' : undefined })
          : h('path', { key: i, d: s[1], fill: s[2] ? 'currentColor' : 'none', stroke: s[2] ? 'none' : undefined });
      }));
  }
  Icon.names = Object.keys(ICONS);

  // ---------- 단계 머리: 단계 이름 + 시간 링. 안내 한 줄은 처음 잠깐만(showHint) ----------
  function PhaseHeader(p) {
    var hasTime = p.time != null && p.total, urgent = hasTime && p.time <= 5, R = 18, C = 2 * Math.PI * R;
    var frac = hasTime ? Math.max(0, Math.min(1, p.time / p.total)) : 0;
    return h('header', { className: 'mv-phase' },
      h('div', { className: 'mv-phase__text' },
        h('span', { className: 'mv-phase__title' }, p.title),
        p.hint ? h('span', { className: cx('mv-phase__hint', p.showHint === false && 'is-folded') }, p.hint) : null),
      hasTime ? h('span', { className: cx('mv-ring', urgent && 'is-urgent'), role: 'timer', 'aria-label': '남은 시간 ' + p.time + '초' },
        h('svg', { width: 44, height: 44, viewBox: '0 0 44 44', 'aria-hidden': 'true' },
          h('circle', { cx: 22, cy: 22, r: R, className: 'mv-ring__track' }),
          h('circle', { cx: 22, cy: 22, r: R, className: 'mv-ring__bar', strokeDasharray: C, strokeDashoffset: C * (1 - frac), transform: 'rotate(-90 22 22)' })),
        urgent ? h('span', { className: 'mv-ring__num' }, p.time) : null) : null);
  }

  // ---------- 점 진행: ●●●○○ ----------
  function DotProgress(p) {
    var dots = [];
    for (var i = 0; i < p.total; i++) dots.push(h('span', { key: i, className: cx('mv-dots__dot', i < p.count && 'is-on') }));
    return h('span', { className: 'mv-dots', role: 'img', 'aria-label': (p.label || '') + ' ' + p.count + '/' + p.total }, dots);
  }

  // ---------- 이름표: 점 + 이름. 나는 테두리, 내가 고른 사람은 손가락, 투표한 사람은 체크 ----------
  function NameTag(p) {
    return h('span', { className: cx('mv-tag', p.me && 'is-me', p.away && 'is-away', p.blink && 'is-blink', p.mine && 'is-mine') },
      h('span', { className: 'mv-tag__dot', style: { background: p.color } }),
      h('span', { className: 'mv-tag__name' }, p.me ? p.name + ' (나)' : p.name),
      p.mine ? h(Icon, { name: 'point', size: 16, label: '내가 가리킨 사람' }) : null,
      p.done ? h(Icon, { name: 'check', size: 16, label: '투표함' }) : null);
  }

  function VoteBadge(p) {
    return h('span', { className: cx('mv-badge', p.lead && 'is-lead'), role: 'img', 'aria-label': p.count + '표' + (p.lead ? ', 가장 많이 지목받음' : '') },
      h('span', { className: 'mv-badge__num' }, p.count),
      h('span', { className: 'mv-badge__unit', 'aria-hidden': 'true' }, '표'));
  }

  function SureStamp(p) { return h('span', { className: 'mv-stamp' }, p.label || '유력'); }

  // ---------- 머리 위 쌓임: 입력 중 · 도장 · 배지 · 이름표 ----------
  function HeadStack(p) {
    return h('div', { className: cx('mv-head', p.lead && 'is-lead') },
      p.typing ? h('span', { className: 'mv-typing', role: 'img', 'aria-label': '입력 중' }, h('i'), h('i'), h('i')) : null,
      p.role ? h(RoleChip, { role: p.role }) : null,
      p.sure ? h(SureStamp, { label: p.sureLabel }) : null,
      p.count > 0 ? h(VoteBadge, { count: p.count, lead: p.lead }) : null,
      h(NameTag, { name: p.name, color: p.color, me: p.me, away: p.away, mine: p.mine, done: p.done, blink: p.blink }));
  }

  function TopToast(p) {
    return h('div', { className: cx('mv-toast', p.visible && 'is-on'), role: 'status', 'aria-live': 'polite' },
      h('span', { className: 'mv-toast__text' }, p.icon ? h(Icon, { name: p.icon, size: 18 }) : null, p.text || ''));
  }

  // ---------- 채팅: 기록 + [감정표현] 입력 [보내기]. 감정표현은 입력칸 위로 한 줄 펼쳐진다 ----------
  function ChatPanel(p) {
    var st = React.useState(false), open = st[0], setOpen = st[1];
    var msgs = p.messages || [], id = p.inputId || 'mv-chat-input', val = p.value || '', emotes = p.emotes || [];
    return h('section', { className: 'mv-chat', 'aria-label': '채팅' },
      h('div', { className: 'mv-chat__log', role: 'log' }, msgs.map(function (m, i) {
        if (m.kind === 'player') {
          return h('p', { key: i, className: cx('mv-chat__msg', m.channel === 'mafia' && 'is-mafia') },
            h('span', { className: 'mv-chat__dot', style: { background: m.color } }),
            h('b', { className: 'mv-chat__name' }, m.name),
            h('span', { className: 'mv-chat__text' }, m.text));
        }
        if (m.kind === 'card') {
          return h('div', { key: i, className: cx('mv-chat__card', m.tone === 'mafia' && 'is-mafia') },
            h('span', { className: 'mv-chat__card-title' }, m.icon ? h(Icon, { name: m.icon, size: 16 }) : null, m.title),
            h('p', { className: 'mv-chat__card-text' }, m.text));
        }
        return h('p', { key: i, className: cx('mv-chat__sys', 'is-' + (m.kind || 'system')) },
          m.icon ? h(Icon, { name: m.icon, size: 16 }) : null, h('span', null, m.text));
      })),
      open && emotes.length ? h('div', { className: 'mv-chat__emotes', role: 'group', 'aria-label': '감정표현' }, emotes.map(function (e) {
        return h('button', { key: e.id, type: 'button', className: 'mv-chat__emote', 'aria-label': e.label, title: e.label,
          onClick: function () { setOpen(false); if (p.onEmote) p.onEmote(e.id); } }, h(Icon, { name: e.id, size: 26 }));
      })) : null,
      p.onSend ? h('form', { className: 'mv-chat__form', onSubmit: function (e) { e.preventDefault(); if (val.trim()) p.onSend(val); } },
        emotes.length ? h('button', { type: 'button', className: cx('mv-chat__icon', open && 'is-on'), 'aria-label': '감정표현', 'aria-expanded': open ? 'true' : 'false',
          onClick: function () { setOpen(!open); } }, h(Icon, { name: 'face' })) : null,
        h('label', { className: 'mv-sr', htmlFor: id }, '메시지'),
        h('input', { id: id, className: 'mv-chat__input', value: val, placeholder: p.placeholder || '', disabled: p.disabled, maxLength: 100, autoComplete: 'off', enterKeyHint: 'send',
          onChange: function (e) { if (p.onChange) p.onChange(e.target.value); } }),
        h('button', { type: 'submit', className: 'mv-chat__send', 'aria-label': '보내기', disabled: p.disabled || !val.trim() }, h(Icon, { name: 'send' }))) : null);
  }

  // ---------- 꾸미기 창: 방장은 [맵 | 의상] 두 탭, 다른 사람은 의상만 ----------
  function DressSheet(p) {
    var st = React.useState(p.host ? (p.tab || 'map') : 'outfit'), tab = p.host ? st[0] : 'outfit', setTab = st[1];
    var maps = p.maps || [], outfits = p.outfits || [];
    return h('div', { className: 'mv-dress', role: 'dialog', 'aria-label': '꾸미기' },
      h('div', { className: 'mv-dress__top' },
        p.host ? h('div', { className: 'mv-dress__tabs', role: 'tablist' },
          [['map', 'map', '맵'], ['outfit', 'hanger', '의상']].map(function (t) {
            return h('button', { key: t[0], type: 'button', role: 'tab', 'aria-selected': tab === t[0] ? 'true' : 'false', className: cx('mv-dress__tab', tab === t[0] && 'is-on'),
              onClick: function () { setTab(t[0]); } }, h(Icon, { name: t[1], size: 20 }), t[2]);
          })) : h('span', { className: 'mv-dress__title' }, h(Icon, { name: 'hanger', size: 20 }), '의상'),
        p.onClose ? h('button', { type: 'button', className: 'mv-dress__close', 'aria-label': '닫기', onClick: p.onClose }, h(Icon, { name: 'close' })) : null),
      tab === 'map' ? h('div', { className: 'mv-dress__maps', role: 'radiogroup', 'aria-label': '맵' }, maps.map(function (m) {
        var on = m.id === p.mapId;
        return h('button', { key: m.id, type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', className: cx('mv-mapcard', on && 'is-on'),
          onClick: function () { if (p.onMap) p.onMap(m.id); } },
          m.img ? h('img', { className: 'mv-mapcard__img', src: m.img, alt: '', draggable: false }) : h('span', { className: 'mv-mapcard__img is-random' }, h(Icon, { name: 'question', size: 44 })),
          h('span', { className: 'mv-mapcard__label' }, m.label),
          on ? h('span', { className: 'mv-mapcard__check' }, h(Icon, { name: 'check', size: 16 })) : null);
      })) : h('div', { className: 'mv-dress__outfits', role: 'radiogroup', 'aria-label': '의상' }, outfits.map(function (o) {
        var on = o.id === p.outfitId;
        return h('button', { key: o.id, type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', className: cx('mv-outfit', on && 'is-on'),
          onClick: function () { if (p.onOutfit) p.onOutfit(o.id); } },
          h('img', { className: 'mv-outfit__img', src: o.img, alt: '', draggable: false }),
          h('span', { className: 'mv-outfit__label' }, o.label));
      })));
  }

  // ---------- 역할 카드(v1.0 직업 카드 그대로): 뒷면 마름모 → 눌러서 뒤집기 ----------
  function Diamond() {
    return h('svg', { className: 'mv-card__diamond', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
      h('path', { d: 'M50 4 96 50 50 96 4 50z', fill: 'none', stroke: 'var(--gray-500)', strokeWidth: 2 }),
      h('path', { d: 'M50 18 82 50 50 82 18 50z', fill: 'var(--crimson-500)' }),
      h('path', { d: 'M50 34 66 50 50 66 34 50z', fill: 'var(--night-800)' }));
  }
  function RoleCard(p) {
    var front = p.face === 'front' && p.role;
    return h('button', { type: 'button', className: cx('mv-card', front && 'is-front'), 'aria-label': front ? p.name : '역할 카드 뒤집기', onClick: p.onFlip },
      h('span', { className: 'mv-card__inner' },
        h('span', { className: 'mv-card__face mv-card__back' }, h(Diamond)),
        front ? h('span', { className: 'mv-card__face mv-card__front' },
          p.img ? h('img', { className: 'mv-card__art', src: p.img, alt: '', draggable: false }) : null,
          h('span', { className: 'mv-card__name' }, p.name),
          p.desc ? h('span', { className: 'mv-card__desc' }, p.desc) : null,
          p.mates ? h('span', { className: 'mv-card__mates' }, p.mates) : null) : null));
  }

  // ---------- 찬반: 엄지 위·아래 큰 버튼 ----------
  function VerdictPicker(p) {
    return h('div', { className: 'mv-verdict', role: 'radiogroup', 'aria-label': '찬반' },
      [['yes', 'thumbUp', '찬성'], ['no', 'thumbDown', '반대']].map(function (v) {
        var on = p.value === v[0];
        return h('button', { key: v[0], type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', className: cx('mv-verdict__btn', on && 'is-on'), disabled: p.disabled,
          onClick: function () { if (p.onChange) p.onChange(v[0]); } }, h(Icon, { name: v[1], size: 32 }), h('span', null, v[2]));
      }));
  }

  // ---------- 직업 표시: 머리 위 작은 원 안의 직업 아이콘(유령 관전·마피아 동료) ----------
  var ROLE = { mafia: ['roleMafia', '마피아'], police: ['rolePolice', '경찰'], doctor: ['roleDoctor', '의사'], citizen: ['roleCitizen', '시민'] };
  function RoleChip(p) {
    var r = ROLE[p.role] || ROLE.citizen;
    return h('span', { className: cx('mv-rolechip', 'is-' + p.role), role: 'img', 'aria-label': r[1] }, h(Icon, { name: r[0], size: 18 }));
  }

  // ---------- 얼굴 목록: 깜깜한 밤에 경찰·의사가 대상을 고른다 ----------
  function FaceList(p) {
    return h('div', { className: 'mv-faces', role: 'radiogroup', 'aria-label': p.label || '대상' }, (p.faces || []).map(function (f) {
      var on = f.id === p.value;
      return h('button', { key: f.id, type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', 'aria-label': f.name, disabled: f.disabled,
        className: cx('mv-face', on && 'is-on'), onClick: function () { if (p.onPick) p.onPick(f.id); } },
        h('img', { className: 'mv-face__img', src: f.img, alt: '', draggable: false }),
        h('span', { className: 'mv-face__name' }, h('i', { style: { background: f.color } }), f.name),
        on ? h('span', { className: 'mv-face__mark' }, h(Icon, { name: p.icon || 'check', size: 18 })) : null);
    }));
  }

  // ---------- 유언 쓰기: 언제든 깃펜으로 연다. 죽으면 모두에게 공개된다 ----------
  function WillSheet(p) {
    var id = p.inputId || 'mv-will';
    var title = p.title || '유언';
    return h('div', { className: cx('mv-will', p.tone === 'mafia' && 'is-mafia'), role: 'dialog', 'aria-label': title },
      h('div', { className: 'mv-dress__top' },
        h('span', { className: 'mv-dress__title' }, h(Icon, { name: p.icon || 'quill', size: 20 }), title),
        p.onClose ? h('button', { type: 'button', className: 'mv-dress__close', 'aria-label': '닫기', onClick: p.onClose }, h(Icon, { name: 'close' })) : null),
      h('label', { className: 'mv-sr', htmlFor: id }, title),
      h('textarea', { id: id, className: 'mv-will__text', value: p.value || '', maxLength: p.max || 100, rows: 3, placeholder: p.placeholder || '죽으면 모두에게 보여요',
        onChange: function (e) { if (p.onChange) p.onChange(e.target.value); } }),
      h('div', { className: 'mv-will__foot' },
        h('span', { className: 'mv-will__count' }, (p.value || '').length + '/' + (p.max || 100)),
        h('button', { type: 'button', className: 'mv-will__save', onClick: p.onSave, disabled: !!p.saved }, h(Icon, { name: 'check', size: 20 }), p.saved ? '저장됨' : '저장')));
  }

  window.MinifiaV2 = {
    Icon: Icon, PhaseHeader: PhaseHeader, DotProgress: DotProgress, NameTag: NameTag, VoteBadge: VoteBadge, SureStamp: SureStamp, HeadStack: HeadStack,
    TopToast: TopToast, ChatPanel: ChatPanel, DressSheet: DressSheet, RoleCard: RoleCard, VerdictPicker: VerdictPicker,
    RoleChip: RoleChip, FaceList: FaceList, WillSheet: WillSheet
  };
})();
