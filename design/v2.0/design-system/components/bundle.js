/* @ds-bundle: {"format":4,"namespace":"MinifiaV2","components":[{"name":"PhaseHeader"},{"name":"NameTag"},{"name":"VoteBadge"},{"name":"SureStamp"},{"name":"HeadStack"},{"name":"TopToast"},{"name":"ChatPanel"},{"name":"EmoteSheet"},{"name":"MapPicker"}]} */
/* minifia v2.0 게임 겹침 부품. 3D 장면(three.js) 위 DOM 층과 아래 패널에 쓴다. React 18 은 쓰는 쪽이 준다 */
(function () {
  var h = window.React.createElement;
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }

  // 단계 머리: 단계 이름 + 지금 할 일 한 문장 + 남은 시간(마지막 5초는 진홍)
  function PhaseHeader(p) {
    return h('header', { className: 'mv-phase' },
      h('div', { className: 'mv-phase__text' },
        h('span', { className: 'mv-phase__title' }, p.title),
        p.hint ? h('span', { className: 'mv-phase__hint' }, p.hint) : null),
      p.time != null ? h('span', { className: cx('mv-phase__time', p.urgent && 'is-urgent'), 'aria-label': '남은 시간 ' + p.time + '초' }, p.time) : null);
  }

  // 이름표: 자리 구분색 점 + 이름. 나는 테두리, 끊긴 사람은 흐리게
  function NameTag(p) {
    return h('span', { className: cx('mv-tag', p.me && 'is-me', p.away && 'is-away') },
      h('span', { className: 'mv-tag__dot', style: { background: p.color } }),
      h('span', { className: 'mv-tag__name' }, p.me ? p.name + ' (나)' : p.name));
  }

  // 득표 배지: 숫자 + '표'. 선두면 커지며 맥박처럼 뛰고 빛이 번진다
  function VoteBadge(p) {
    return h('span', { className: cx('mv-badge', p.lead && 'is-lead'), role: 'img', 'aria-label': p.count + '표' + (p.lead ? ', 가장 많이 지목받음' : '') },
      h('span', { className: 'mv-badge__num' }, p.count),
      h('span', { className: 'mv-badge__unit', 'aria-hidden': 'true' }, '표'));
  }

  // 과반 도장
  function SureStamp(p) {
    return h('span', { className: 'mv-stamp' }, p.label || '유력');
  }

  // 머리 위 쌓임: 위에서부터 도장 · 배지 · 이름표. 바닥 가운데가 머리 꼭대기에 닿게 놓는다
  function HeadStack(p) {
    return h('div', { className: cx('mv-head', p.lead && 'is-lead') },
      p.sure ? h(SureStamp, null) : null,
      p.count > 0 ? h(VoteBadge, { count: p.count, lead: p.lead }) : null,
      h(NameTag, { name: p.name, color: p.color, me: p.me, away: p.away }));
  }

  // 화면 위 한 줄 알림: 지목 순간을 1.5초 보여 주고 사라진다. 기록은 채팅이 맡는다
  function TopToast(p) {
    return h('div', { className: cx('mv-toast', p.visible && 'is-on'), role: 'status', 'aria-live': 'polite' },
      h('span', { className: 'mv-toast__text' }, p.text || ''));
  }

  // 채팅: 사람 메시지와 시스템 메시지(단계 안내·지목 기록·선두 소식)를 한 기록에 둔다
  function ChatPanel(p) {
    var msgs = p.messages || [], id = p.inputId || 'mv-chat-input', val = p.value || '';
    return h('section', { className: 'mv-chat', 'aria-label': '채팅' },
      h('div', { className: 'mv-chat__log', role: 'log' }, msgs.map(function (m, i) {
        if (m.kind === 'player') {
          return h('p', { key: i, className: cx('mv-chat__msg', m.channel === 'mafia' && 'is-mafia') },
            h('span', { className: 'mv-chat__dot', style: { background: m.color } }),
            h('b', { className: 'mv-chat__name' }, m.name),
            h('span', { className: 'mv-chat__text' }, m.text));
        }
        return h('p', { key: i, className: cx('mv-chat__sys', 'is-' + (m.kind || 'system')) }, m.text);
      })),
      p.onSend ? h('form', { className: 'mv-chat__form', onSubmit: function (e) { e.preventDefault(); if (val.trim()) p.onSend(val); } },
        h('label', { className: 'mv-sr', htmlFor: id }, '메시지'),
        h('input', { id: id, className: 'mv-chat__input', value: val, placeholder: p.placeholder || '메시지 보내기', disabled: p.disabled, maxLength: 100, autoComplete: 'off',
          onChange: function (e) { if (p.onChange) p.onChange(e.target.value); } }),
        h('button', { type: 'submit', className: 'mv-chat__send', disabled: p.disabled || !val.trim() }, '보내기')) : null);
  }

  // 동작 목록: 4칸 격자 버튼
  function EmoteSheet(p) {
    return h('div', { className: 'mv-emotes', role: 'group', 'aria-label': '동작' }, (p.emotes || []).map(function (e) {
      return h('button', { key: e.id, type: 'button', className: 'mv-emotes__btn', disabled: p.disabled, onClick: function () { if (p.onPick) p.onPick(e.id); } }, e.label);
    }));
  }

  // 맵 선택(로비): 방장만 고른다. 다른 사람은 지금 맵을 글로 본다
  function MapPicker(p) {
    var maps = p.maps || [], cur = maps.filter(function (m) { return m.id === p.value; })[0];
    if (!p.host) return h('p', { className: 'mv-maps__guest' }, '맵 · ' + (cur ? cur.label : '랜덤') + ' — 방장이 골라요');
    return h('div', { className: 'mv-maps', role: 'radiogroup', 'aria-label': '맵' }, maps.map(function (m) {
      var on = m.id === p.value;
      return h('button', { key: m.id, type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', className: cx('mv-maps__opt', on && 'is-on'),
        onClick: function () { if (p.onChange) p.onChange(m.id); } },
        h('span', { className: 'mv-maps__label' }, m.label),
        m.desc ? h('span', { className: 'mv-maps__desc' }, m.desc) : null);
    }));
  }

  window.MinifiaV2 = {
    PhaseHeader: PhaseHeader, NameTag: NameTag, VoteBadge: VoteBadge, SureStamp: SureStamp, HeadStack: HeadStack,
    TopToast: TopToast, ChatPanel: ChatPanel, EmoteSheet: EmoteSheet, MapPicker: MapPicker
  };
})();
