export type Choice = { label: string; action: () => void; quiet?: boolean };
export type HandprintAge = 'fresh' | 'travelled' | 'weathered' | 'worn';

export class NarrativeUI {
  readonly title = this.element('#title-screen');
  readonly hud = this.element('#chapter-hud');
  readonly reticle = this.element('#reticle');
  readonly objective = this.element('#objective');
  readonly prompt = this.element('#interaction-prompt');
  readonly promptText = this.element('#interaction-text');
  readonly dialogue = this.element('#dialogue');
  readonly speechBubble = this.element('#speech-bubble');
  readonly murmurs = this.element('#street-murmurs');
  readonly handprint = this.element('#handprint-view');
  readonly chapterCard = this.element('#chapter-card');
  readonly ending = this.element('#ending');
  readonly handprintButton = this.element('#handprint-button');
  readonly chapterNav = this.element('#chapter-nav');
  private readonly touchControls = this.element('#touch-controls');
  private readonly touchInteract = this.element<HTMLButtonElement>('#touch-interact');
  private cardTimer?: number;
  private readonly timeWash = this.element('#time-wash');
  private readonly impactWash = this.element('#impact-wash');
  private readonly cinematicBars = this.element('#cinematic-bars');
  private readonly chapterKicker = this.element('#chapter-kicker');
  private readonly chapterTitle = this.element('#chapter-title');
  private readonly dialogueContext = this.element('#dialogue-context');
  private readonly speaker = this.element('#speaker-name');
  private readonly line = this.element('#dialogue-line');
  private readonly choices = this.element('#dialogue-choices');
  private readonly bubbleSpeaker = this.element('#bubble-speaker');
  private readonly bubbleLine = this.element('#bubble-line');
  private selectedChoice = 0;

  constructor() {
    document.addEventListener('keydown', (event) => {
      if (this.dialogue.classList.contains('hidden')) return;
      const buttons = this.choices.querySelectorAll<HTMLButtonElement>('button');
      if (!buttons.length || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'NumpadEnter'].includes(event.code)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.code === 'Enter' || event.code === 'NumpadEnter') {
        if (!event.repeat) buttons[this.selectedChoice]?.click();
        return;
      }
      const direction = event.code === 'ArrowUp' || event.code === 'ArrowLeft' ? -1 : 1;
      this.selectChoice((this.selectedChoice + direction + buttons.length) % buttons.length, true);
    }, true);
  }

  private selectChoice(index: number, focus = false): void {
    this.selectedChoice = index;
    const buttons = this.choices.querySelectorAll<HTMLButtonElement>('button');
    buttons.forEach((button, i) => button.classList.toggle('choice-selected', i === index));
    if (focus) {
      buttons[index]?.focus({ preventScroll: true });
      buttons[index]?.scrollIntoView({ block: 'nearest' });
    }
  }

  gameplayVisible(visible: boolean): void {
    for (const element of [this.hud, this.reticle, this.objective, this.handprintButton, this.chapterNav]) {
      element.classList.toggle('hidden', !visible);
    }
    this.touchControls.classList.toggle('hidden', !visible);
  }

  setChapter(kicker: string, title: string): void {
    this.chapterKicker.textContent = `${kicker} |`;
    this.chapterTitle.textContent = title;
  }

  setObjective(copy: string): void {
    this.objective.textContent = copy;
  }

  setPrompt(copy?: string): void {
    this.prompt.classList.toggle('hidden', !copy);
    this.reticle.classList.toggle('targeting', Boolean(copy));
    this.touchInteract.classList.toggle('hidden', !copy);
    if (copy) this.promptText.textContent = copy;
    this.touchInteract.textContent = copy ?? 'Interact';
  }

  showDialogue(context: string, speaker: string, line: string, choices: Choice[], anchored = false): void {
    this.setPrompt();
    if (document.pointerLockElement) void document.exitPointerLock();
    this.dialogueContext.textContent = context;
    this.dialogueContext.classList.toggle('hidden', !context.toLowerCase().includes('counterfactual'));
    this.speaker.textContent = speaker;
    this.line.textContent = line;
    const isThought = /thought/i.test(context) || /thought/i.test(speaker);
    const thought = this.element('#inner-thought');
    thought.textContent = isThought ? line : '';
    thought.classList.toggle('hidden', !isThought);
    this.dialogue.classList.toggle('thought-mode', isThought);
    this.dialogue.classList.toggle('anchored', anchored);
    this.bubbleSpeaker.textContent = speaker;
    this.bubbleLine.textContent = line;
    this.speechBubble.classList.toggle('hidden', !anchored);
    this.choices.replaceChildren();
    for (const [index, choice] of choices.entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = choice.label;
      button.classList.toggle('quiet', Boolean(choice.quiet));
      button.addEventListener('click', choice.action, { once: true });
      button.addEventListener('pointerenter', () => this.selectChoice(index));
      button.addEventListener('focus', () => this.selectChoice(index));
      this.choices.append(button);
    }
    this.dialogue.classList.remove('dialogue-enter');
    void this.dialogue.offsetWidth;
    this.dialogue.classList.add('dialogue-enter');
    this.dialogue.classList.remove('hidden');
    this.touchControls.classList.add('hidden');
    this.selectChoice(0, !matchMedia('(pointer: coarse)').matches);
  }

  closeDialogue(): void {
    this.element('#inner-thought').classList.add('hidden');
    this.dialogue.classList.add('hidden');
    this.speechBubble.classList.add('hidden');
    this.dialogue.classList.remove('anchored');
    this.touchControls.classList.remove('hidden');
  }

  clearMurmurs(): void {
    this.murmurs.replaceChildren();
  }

  positionSpeechBubble(x: number, y: number, visible: boolean): void {
    this.speechBubble.classList.toggle('hidden', !visible);
    if (!visible) return;
    this.speechBubble.style.left = `${x}px`;
    this.speechBubble.style.top = `${y}px`;
  }

  showHandprint(age: HandprintAge): void {
    if (document.pointerLockElement) void document.exitPointerLock();
    this.handprint.dataset.age = age;
    this.handprint.classList.remove('hidden');
    this.touchControls.classList.add('hidden');
  }

  closeHandprint(): void {
    this.handprint.classList.add('hidden');
    this.touchControls.classList.remove('hidden');
  }

  showCard(kicker: string, title: string, copy: string, onContinue: () => void): void {
    if (document.pointerLockElement) void document.exitPointerLock();
    this.touchControls.classList.add('hidden');
    this.element('#card-kicker').textContent = kicker;
    this.element('#card-title').textContent = title;
    this.chapterCard.classList.toggle('year-card', /^YEAR \d+$/.test(title));
    const cardCopy = this.element('#card-copy');
    cardCopy.textContent = copy;
    cardCopy.classList.toggle('hidden', !copy);
    const button = this.element<HTMLButtonElement>('#continue-button');
    button.onclick = onContinue;
    this.chapterCard.classList.remove('card-leave');
    this.chapterCard.classList.add('card-enter');
    this.chapterCard.classList.remove('hidden');
  }

  hideCard(onHidden?: () => void): void {
    this.chapterCard.classList.remove('card-enter');
    this.chapterCard.classList.add('card-leave');
    const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 20 : 620;
    this.cardTimer = window.setTimeout(() => {
      this.chapterCard.classList.add('hidden');
      this.chapterCard.classList.remove('card-leave');
      this.touchControls.classList.remove('hidden');
      onHidden?.();
    }, delay);
  }

  cancelCard(): void {
    window.clearTimeout(this.cardTimer);
    this.chapterCard.classList.add('hidden');
    this.chapterCard.classList.remove('card-leave', 'card-enter');
    this.touchControls.classList.remove('hidden');
  }

  hideTitle(onHidden: () => void): void {
    this.title.classList.add('title-leave');
    const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 20 : 720;
    window.setTimeout(() => {
      this.title.classList.add('hidden');
      onHidden();
    }, delay);
  }

  pulseTime(): void {
    this.timeWash.classList.remove('pulse');
    void this.timeWash.offsetWidth;
    this.timeWash.classList.add('pulse');
  }

  setCinematic(active: boolean): void {
    this.cinematicBars.classList.toggle('hidden', !active);
    this.hud.classList.toggle('cinematic-dim', active);
    this.objective.classList.toggle('cinematic-dim', active);
    this.reticle.classList.toggle('hidden', active);
    this.touchControls.classList.toggle('hidden', active);
    this.setPrompt();
  }

  pulseImpact(): void {
    this.impactWash.classList.remove('impact');
    void this.impactWash.offsetWidth;
    this.impactWash.classList.add('impact');
  }

  private element<T extends HTMLElement = HTMLElement>(selector: string): T {
    const result = document.querySelector<T>(selector);
    if (!result) throw new Error(`Missing UI element: ${selector}`);
    return result;
  }
}
