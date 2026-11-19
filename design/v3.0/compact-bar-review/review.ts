import { mountScene, people } from './scene';

type Mode = 'walk' | 'table' | 'speaker';
type Discussion = Exclude<Mode, 'walk'>;

function element<T extends HTMLElement>(selector: string): T {
  const match = document.querySelector<T>(selector);
  if (!match) throw new Error(`시안 요소 누락 ${selector}`);
  return match;
}

const scenes: Partial<Record<Mode, ReturnType<typeof mountScene>>> = {};
const initialSpeaker = 2;
const state = {
  table: { focus: initialSpeaker, marking: false, marked: null as number | null },
  speaker: { focus: initialSpeaker, marking: false, marked: null as number | null },
};
const tabs = [...document.querySelectorAll<HTMLButtonElement>('[data-show]')];
const panels = [...document.querySelectorAll<HTMLElement>('[data-panel]')];
const roster = element('.roster');
const rosterButtons = people.map((person, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  const image = document.createElement('img');
  image.alt = '';
  image.src = `/characters/animals/${person.animal}/face.png`;
  button.append(image, person.name);
  button.addEventListener('click', () => choose('speaker', index));
  roster.append(button);
  return button;
});

function show(panel: string): void {
  for (const tab of tabs) tab.setAttribute('aria-pressed', String(tab.dataset.show === panel));
  for (const section of panels) section.classList.toggle('shown', section.dataset.panel === panel);
}

function sync(mode: Discussion): void {
  const { focus, marked, marking } = state[mode];
  const person = people[focus]!;
  const name = document.createElement('b');
  name.textContent = person.name;
  const quote = document.createElement('q');
  quote.textContent = person.line;
  element(`#${mode}-line`).replaceChildren(name, quote);

  const status = element(`[data-status="${mode}"]`);
  status.textContent = marking ? '딱지를 붙일 친구를 고르세요' : marked !== null ? `${people[marked]!.name}에게 딱지 부착` : mode === 'table' ? '이름표를 눌러 발언 확인' : '얼굴을 눌러 발언 확인';
  element(`[data-note="${mode}"]`).setAttribute('aria-pressed', String(marking));
  if (mode === 'speaker') {
    for (const [index, button] of rosterButtons.entries()) {
      const isMarked = index === marked;
      button.setAttribute('aria-pressed', String(index === focus));
      button.setAttribute('aria-label', `${people[index]!.name}${isMarked ? ' · 의심딱지' : ''}`);
      button.dataset.marked = String(isMarked);
    }
  }
}

function choose(mode: Discussion, index: number): void {
  const discussion = state[mode];
  if (discussion.marking) {
    discussion.marked = discussion.marked === index ? null : index;
    discussion.marking = false;
    scenes[mode]?.setMark(discussion.marked);
  } else {
    discussion.focus = index;
    scenes[mode]?.setFocus(index);
  }
  sync(mode);
}

for (const tab of tabs) tab.addEventListener('click', () => show(tab.dataset.show!));
element('#gather').addEventListener('click', () => {
  show('speaker');
  element('[data-panel="speaker"]').scrollIntoView({ block: 'nearest' });
  rosterButtons[initialSpeaker]?.focus({ preventScroll: true });
});

for (const mode of ['walk', 'table', 'speaker'] as const) {
  const host = element(`#${mode}-world`);
  if (mode !== 'walk') {
    element(`[data-note="${mode}"]`).addEventListener('click', () => {
      state[mode].marking = !state[mode].marking;
      sync(mode);
    });
    sync(mode);
  }
  try {
    scenes[mode] = mountScene(host, mode, index => {
      if (mode !== 'walk') choose(mode, index);
      else scenes.walk?.setFocus(index);
    });
    if (mode !== 'walk') scenes[mode].setFocus(initialSpeaker);
  } catch (error) {
    console.error(error);
    const message = document.createElement('div');
    message.className = 'screen-error';
    message.textContent = '이 브라우저에서 3D 시안을 표시할 수 없어요.';
    host.replaceChildren(message);
  }
}
