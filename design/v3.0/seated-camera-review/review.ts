import { mountScene, oppositeSeatOf, previewSeatOf, seatedPeople } from './scene';
import type { ViewMode } from './scene';
import { isTableCount, TABLE_COUNTS } from './table-layout';
import { ANIMAL_IDS, ANIMALS, isAnimalId } from '../../../shared/game/animals';
import { animalFaceSrc } from '../../../src/net/assets';

const views = {
  eye: { name: '내 자리 눈높이', short: '눈높이', description: '내 자리에서 상대 얼굴을 바라보기' },
  shoulder: { name: '어깨 너머', short: '어깨 너머', description: '내 자리와 맞은편 대화 상대를 함께 보기' },
  wide: { name: '테이블 전체', short: '전체 보기', description: '착석 배치와 선택 대상을 한눈에 확인' },
} satisfies Record<ViewMode, { name: string; short: string; description: string }>;

function find<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`시안 요소 누락 ${selector}`);
  return element;
}

function portrait(index: number): string {
  return animalFaceSrc(people[index]!.animal);
}

const template = find<HTMLTemplateElement>(document, '#panel');
const nav = find(document, '.views');
const comparison = find(document, '.comparison');
const options = find<HTMLDetailsElement>(document, '.comparison-options');
const singleView = matchMedia('(max-width: 1040px)');
options.open = !singleView.matches;
const query = new URLSearchParams(location.search);
const requestedArt = query.get('art');
const art = requestedArt === 'original' || requestedArt === 'polished' ? requestedArt : 'detailed';
const model = query.get('model') === 'original' ? 'original' : 'detail';
const requestedCount = Number(query.get('players'));
const tableCount = isTableCount(requestedCount) ? requestedCount : 8;
const requestedAnimal = query.get('animal');
const previewAnimal = isAnimalId(requestedAnimal) ? requestedAnimal : undefined;
const people = seatedPeople(tableCount, previewAnimal);
const previewSeat = previewSeatOf(people);
const oppositeSeat = oppositeSeatOf(people);
const countSelect = find<HTMLSelectElement>(document, '.table-count');
for (const count of TABLE_COUNTS) countSelect.add(new Option(`${count}명`, String(count)));
countSelect.value = String(tableCount);
countSelect.addEventListener('change', () => {
  const next = Number(countSelect.value);
  if (!isTableCount(next) || next === tableCount) return;
  const params = new URLSearchParams({ art, model, players: String(next), view: activeMode });
  if (previewAnimal) params.set('animal', previewAnimal);
  location.search = params.toString();
});
const animalSelect = find<HTMLSelectElement>(document, '.preview-animal');
for (const animal of ANIMAL_IDS) animalSelect.add(new Option(ANIMALS[animal].name, animal));
animalSelect.value = previewAnimal ?? '';
animalSelect.addEventListener('change', () => {
  const params = new URLSearchParams({ art, model, players: String(tableCount) });
  if (isAnimalId(animalSelect.value)) {
    params.set('animal', animalSelect.value);
    params.set('focus', String(previewSeat));
    params.set('view', 'eye');
  }
  location.search = params.toString();
});
const styleLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('.variants a'));
find(document, `[data-art="${art}"]`).setAttribute('aria-current', 'true');
find(document, `[data-model="${model}"]`).setAttribute('aria-current', 'true');
const controllers: Partial<Record<ViewMode, Awaited<ReturnType<typeof mountScene>>>> = {};
const started = new Set<ViewMode>();
const panels = new Map<ViewMode, {
  section: HTMLElement; world: HTMLElement; tab: HTMLButtonElement; players: HTMLButtonElement[]; mark: HTMLButtonElement;
}>();
const defaultFocus = previewAnimal ? previewSeat : oppositeSeat;
const requestedFocus = Number(query.get('focus') ?? defaultFocus);
const requestedView = query.get('view');
const requestedMark = Number(query.get('mark'));
const speechParam = query.get('speaker');
const requestedSpeaker = Number(speechParam ?? oppositeSeat);
let activeMode: ViewMode = requestedView === 'shoulder' || requestedView === 'wide' ? requestedView : 'eye';
let focus = people[requestedFocus] ? requestedFocus : defaultFocus;
let speaker = people[requestedSpeaker] ? requestedSpeaker : oppositeSeat;
let followSpeech = !previewAnimal || (speechParam !== null && Boolean(people[requestedSpeaker]));
let marking = false;
let marked: number | null = requestedMark > 0 && people[requestedMark] ? requestedMark : null;

function startScene(world: HTMLElement, mode: ViewMode): void {
  if (started.has(mode)) return;
  started.add(mode);
  void mountScene(world, mode, people, choose, {
    art, detailed: model === 'detail', preview: Boolean(previewAnimal),
  }).then(controller => {
    controllers[mode] = controller;
    controller.lookAt(focus, false);
    if (followSpeech) controller.speak(speaker, speaker === 0 ? focus || oppositeSeat : 0);
    controller.mark(marked);
  }).catch(error => {
    console.error(error);
    const message = document.createElement('div');
    message.className = 'world-error';
    message.textContent = '이 브라우저에서 3D 시안을 열 수 없어요.';
    world.replaceChildren(message);
  });
}

function reviewUrl(room: string = art, characters: string = model): string {
  const params = new URLSearchParams({
    art: room, model: characters, players: String(tableCount), focus: String(focus), view: activeMode,
  });
  if (followSpeech) params.set('speaker', String(speaker));
  if (previewAnimal) params.set('animal', previewAnimal);
  if (marked !== null) params.set('mark', String(marked));
  return `?${params}${location.hash}`;
}

function sync(remember = false): void {
  const shown = followSpeech ? speaker : focus;
  const person = people[shown]!;
  const label = followSpeech ? (speaker === 0 ? ' · 내 발언' : ' · 발언 중') : (focus === 0 ? ' · 나' : '');
  if (remember) history.replaceState(history.state, '', reviewUrl());
  for (const link of styleLinks) link.href = reviewUrl(link.dataset.art, link.dataset.model);
  for (const [mode, panel] of panels) {
    panel.tab.setAttribute('aria-pressed', String(mode === activeMode));
    panel.section.classList.toggle('active', mode === activeMode);
    if (!singleView.matches || mode === activeMode) startScene(panel.world, mode);
    find(panel.section, '.quote strong').textContent = person.name + label;
    find(panel.section, '.quote p').textContent = person.line;
    find<HTMLImageElement>(panel.section, '.quote img').src = portrait(shown);
    panel.mark.setAttribute('aria-pressed', String(marking));
    const status = find(panel.section, '.action-status');
    if (marking) status.textContent = '붙일 사람을 고르세요';
    else if (marked !== null) status.textContent = `${people[marked]!.name}에게 딱지 부착`;
    else status.textContent = mode === 'wide' ? '얼굴을 눌러 대상 확인' : '밀어서 둘러보기 · 얼굴 눌러 보기';
    panel.players.forEach((button, index) => {
      button.disabled = marking && index === 0;
      button.setAttribute('aria-pressed', String(index === focus));
      button.toggleAttribute('data-marked', index === marked);
      const name = index === 0 ? `${people[index]!.name} · 나` : people[index]!.name;
      const speech = followSpeech && index === speaker ? ' · 발언 중' : '';
      button.setAttribute('aria-label', `${name}${speech}${index === marked ? ' · 의심딱지 붙음' : ''}`);
    });
  }
}

function choose(index: number): void {
  if (!people[index] || (marking && index === 0)) return;
  focus = index;
  if (marking) {
    marked = index;
    marking = false;
  }
  for (const controller of Object.values(controllers)) {
    controller.lookAt(focus);
    controller.mark(marked);
  }
  sync(true);
}

function advanceSpeech(): void {
  followSpeech = true;
  speaker = (speaker + 1) % people.length;
  const listener = speaker === 0 ? focus || oppositeSeat : 0;
  for (const controller of Object.values(controllers)) controller.speak(speaker, listener);
  sync(true);
}

for (const mode of ['eye', 'shoulder', 'wide'] as const) {
  const view = views[mode];
  const section = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
  section.dataset.mode = mode;
  const title = find(section, '.view-title h2');
  title.id = `title-${mode}`;
  title.textContent = view.name;
  section.setAttribute('aria-labelledby', title.id);
  find(section, '.view-title p').textContent = view.description;
  find(section, '.phase-count').textContent = `${tableCount}명`;
  find(section, '.next-speaker').addEventListener('click', advanceSpeech);
  section.querySelectorAll('.chat-line').forEach((line, index) => {
    const person = people[index]!;
    find(line, 'b').textContent = person.name;
    find(line, 'span').textContent = person.line;
  });

  const tab = document.createElement('button');
  tab.type = 'button';
  tab.dataset.show = mode;
  tab.textContent = view.short;
  tab.addEventListener('click', () => {
    activeMode = mode;
    sync(true);
  });
  nav.append(tab);

  const roster = find(section, '.participants');
  roster.dataset.count = String(tableCount);
  const players = people.map((person, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'person';
    button.dataset.person = String(index);
    button.dataset.slot = String(person.slot);
    const image = document.createElement('img');
    image.src = portrait(index);
    image.alt = '';
    const label = document.createElement('span');
    label.textContent = index === 0 ? `${person.name} · 나` : person.name;
    button.append(image, label);
    button.addEventListener('click', () => choose(index));
    roster.append(button);
    return button;
  });

  const mark = find<HTMLButtonElement>(section, '.suspect');
  mark.addEventListener('click', () => {
    marking = !marking;
    sync();
  });
  const world = find(section, '.world');
  world.setAttribute('aria-label', view.name);
  world.toggleAttribute('data-lookable', mode !== 'wide');
  panels.set(mode, { section, world, tab, players, mark });
  comparison.append(section);
}

singleView.addEventListener('change', () => {
  options.open = !singleView.matches;
  sync();
});
sync();
