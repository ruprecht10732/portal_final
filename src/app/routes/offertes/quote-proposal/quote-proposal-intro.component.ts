import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
  Input,
  OnDestroy,
  signal,
  input,
  output
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { gsap } from 'gsap';

@Component({
  selector: 'app-quote-proposal-intro',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './quote-proposal-intro.component.html',
  styleUrl: './quote-proposal-intro.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteProposalIntroComponent implements OnDestroy {
  private readonly injector = inject(Injector);
  private introTimeline: gsap.core.Timeline | null = null;

  @Input() customerName: string | null = null;
  readonly organizationName = input<string | null>(null);
  readonly customerInitial = input.required<string>();

  readonly continue = output<void>();

  protected readonly introOpen = signal(false);
  protected readonly prefersReducedMotion = signal<boolean>(false);

  constructor() {
    if (globalThis.matchMedia) {
      this.prefersReducedMotion.set(globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    afterNextRender(() => this.setupIntroTimeline(), { injector: this.injector });
  }

  ngOnDestroy(): void {
    this.introTimeline?.kill();
    this.introTimeline = null;
  }

  protected toggleIntro(): void {
    if (this.introOpen()) return;

    if (this.prefersReducedMotion()) {
      this.introOpen.set(true);
      return;
    }

    if (this.introTimeline === null) {
      this.introOpen.set(true);
      return;
    }

    this.introTimeline.play(0);
  }

  protected requestContinue(): void {
    this.continue.emit(void 0);
  }

  private setupIntroTimeline(): void {
    if (this.prefersReducedMotion()) {
      this.introOpen.set(true);
      return;
    }

    const tl = gsap.timeline({
      paused: true,
      defaults: { ease: 'expo.inOut', duration: 1 },
    });

    // Initialise GSAP-managed centering so y/z animations stack on top
    gsap.set('#intro-letter', { xPercent: -50, yPercent: -50, z: -1 });

    // 0. Entrance: scene fades in
    gsap.to('#intro-trigger', {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 1.2,
      ease: 'power3.out',
      delay: 0.3,
    });

    // 1. Seal vanishes
    tl.to('#intro-seal', {
      opacity: 0,
      scale: 0.2,
      z: 10,
      duration: 0.6,
      ease: 'power4.in',
    })
      // 2. Lid opens
      .to(
        '#intro-lid',
        {
          rotationX: 180,
          z: -1,
          duration: 0.9,
          ease: 'power3.inOut',
        },
        '-=0.2',
      )
      // 3. Envelope tilts gently
      .to(
        '#intro-envelope',
        {
          rotationX: -12,
          y: 30,
          scale: 0.92,
          duration: 1,
          ease: 'power2.inOut',
        },
        '-=0.5',
      )
      // 4. Letter rises out of envelope (stays behind body at z < 0, clip reveals from top)
      .to(
        '#intro-letter',
        {
          opacity: 1,
          y: -200,
          z: -0.5,
          clipPath: 'inset(0% 0% 10% 0%)',
          duration: 0.9,
          ease: 'power2.out',
          onStart: () => {
            gsap.to('#intro-shadow', { scale: 1.3, opacity: 0.15, duration: 1.2 });
          },
        },
        '-=0.8',
      )
      // 5. Letter floats to center of viewport (now in front of everything)
      .to(
        '#intro-letter',
        {
          z: 80,
          y: 0,
          scale: 1.1,
          clipPath: 'inset(0% 0% 0% 0%)',
          rotationX: 0,
          rotationZ: 0,
          duration: 1,
          ease: 'power2.out',
          boxShadow: '0 30px 80px -15px rgba(0,0,0,0.5)',
        },
        '-=0.2',
      )
      // 6. Fade out envelope
      .to(
        '#intro-envelope',
        {
          opacity: 0,
          scale: 0.8,
          duration: 0.6,
          ease: 'power2.in',
        },
        '-=0.8',
      )
      .to(
        '#intro-shadow',
        {
          opacity: 0,
          duration: 0.4,
        },
        '-=0.6',
      )
      // 7. Shine sweep
      .to(
        '#intro-shine',
        {
          left: '150%',
          duration: 1,
          ease: 'power2.inOut',
        },
        '-=0.7',
      );

    tl.eventCallback('onComplete', () => this.introOpen.set(true));
    this.introTimeline = tl;
  }
}
