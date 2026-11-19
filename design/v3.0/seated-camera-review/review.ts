import { mountScene, people } from './scene';
import type { ViewMode } from './scene';
import { animalFaceSrc } from '../../../src/net/assets';

const views = {
  eye: { name: '내 자리 눈높이', short: '눈높이', description: '내 자리에서 상대 얼굴을 바라보기' },
  shoulder: { name: '어깨 너머', short: '어깨 너머', description: '내 자리와 맞은편 대화 상대를 함께 보기' },
  wide: { name: '테이블 전체', short: '전체 보기', description: '여덟 자리와 선택 대상을 한눈에 확인' },
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
const query = new URLSearchParams(location.search);
const art = query.get('art') === 'original' ? 'original' : 'polished';
const model = query.get('model') === 'original' ? 'original' : 'detail';
const styleLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('.variants a'));
find(document, `[data-art="${art}"]`).setAttribute('aria-current', 'true');
find(document, `[data-model="${model}"]`).setAttribute('aria-current', 'true');
const controllers: Partial<Record<ViewMode, Awaited<ReturnType<typeof mountScene>>>> = {};
const panels = new Map<ViewMode, { section: HTMLElement; tab: HTMLButtonElement; players: HTMLButtonElement[]; mark: HTMLButtonElement }>();
const requestedFocus = Number(query.get('focus') ?? 2);
const requestedView = query.get('view');
let activeMode: ViewMode = requestedView === 'shoulder' || requestedView === 'wide' ? requestedView : 'eye';
let focus = people[requestedFocus] ? requestedFocus : 2;
let marking = false;
let marked: number | null = null;

function sync(): void {
  const person = people[focus]!;
  for (const link of styleLinks) {
    const params = new URLSearchParams({ art: link.dataset.art ?? art, model: link.dataset.model ?? model, focus: String(focus), view: activeMode });
    link.href = `?${params}`;
  }
  for (const [mode, panel] of panels) {
    panel.tab.setAttribute('aria-pressed', String(mode === activeMode));
    panel.section.classList.toggle('active', mode === activeMode);
    find(panel.section, '.quote strong').textContent = focus === 0 ? `${person.name} · 나` : person.name;
    find(panel.section, '.quote p').textContent = person.line;
    find<HTMLImageElement>(panel.section, '.quote img').src = portrait(focus);
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
      button.setAttribute('aria-label', `${name}${index === marked ? ' · 의심딱지 붙음' : ''}`);
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
  sync();
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

  const tab = document.createElement('button');
  tab.type = 'button';
  tab.dataset.show = mode;
  tab.textContent = view.short;
  tab.addEventListener('click', () => {
    activeMode = mode;
    sync();
  });
  nav.append(tab);

  const roster = find(section, '.participants');
  const players = people.map((person, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'person';
    button.dataset.person = String(index);
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
  panels.set(mode, { section, tab, players, mark });
  comparison.append(section);

  const world = find(section, '.world');
  world.setAttribute('aria-label', view.name);
  world.toggleAttribute('data-lookable', mode !== 'wide');
  void mountScene(world, mode, choose, art === 'polished', model === 'detail').then(controller => {
    controllers[mode] = controller;
    controller.lookAt(focus);
    controller.mark(marked);
  }).catch(error => {
    console.error(error);
    const message = document.createElement('div');
    message.className = 'world-error';
    message.textContent = '이 브라우저에서 3D 시안을 열 수 없어요.';
    world.replaceChildren(message);
  });
}

sync();
