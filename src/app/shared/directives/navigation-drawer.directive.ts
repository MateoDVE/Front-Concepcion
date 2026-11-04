import { AfterViewInit, Directive, ElementRef, EventEmitter, HostListener, Inject, Input, OnChanges, OnDestroy, Output, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

@Directive({ selector: '[appNavigationDrawer]', standalone: true })
export class NavigationDrawerDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input() drawerOpen = false;
  @Output() drawerDismiss = new EventEmitter<void>();
  private media?: MediaQueryList;
  private previousFocus: HTMLElement | null = null;
  private previousOverflow = '';
  private locked = false;
  private readonly resize = () => this.sync();

  constructor(private element: ElementRef<HTMLElement>, @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platform: object) {}

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platform)) return;
    this.media = this.document.defaultView!.matchMedia('(max-width: 1023px)');
    this.media.addEventListener('change', this.resize);
    this.sync();
  }
  ngOnChanges() { if (this.media) this.sync(); }
  private sync() {
    const mobile = this.media?.matches;
    const open = !!mobile && this.drawerOpen;
    const drawer = this.element.nativeElement;
    drawer.inert = !!mobile && !open;
    if (open && !this.locked) {
      this.previousFocus = this.document.activeElement as HTMLElement;
      this.previousOverflow = this.document.body.style.overflow;
      this.document.body.style.overflow = 'hidden';
      this.locked = true;
      drawer.querySelector<HTMLElement>('button, a[href]')?.focus();
    } else if (!open && this.locked) {
      this.document.body.style.overflow = this.previousOverflow;
      this.locked = false;
      if (mobile) this.previousFocus?.focus();
    }
  }
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (!this.locked) return;
    if (event.key === 'Escape') { event.preventDefault(); this.drawerDismiss.emit(); }
    if (event.key !== 'Tab') return;
    const controls = Array.from(this.element.nativeElement.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && this.document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && this.document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  ngOnDestroy() {
    this.media?.removeEventListener('change', this.resize);
    if (this.locked) this.document.body.style.overflow = this.previousOverflow;
  }
}
