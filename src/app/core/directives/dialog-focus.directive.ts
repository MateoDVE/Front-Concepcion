import { AfterViewInit, Directive, ElementRef, EventEmitter, HostListener, inject, OnDestroy, Output } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/** Keyboard and focus lifecycle shared by the existing dialogs. */
@Directive({ selector: '[appDialogFocus]', standalone: true, host: { role: 'dialog', 'aria-modal': 'true', tabindex: '-1' } })
export class DialogFocusDirective implements AfterViewInit, OnDestroy {
  private element = inject<ElementRef<HTMLElement>>(ElementRef);
  private document = inject(DOCUMENT);
  private previous: HTMLElement | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  @Output() dialogEscape = new EventEmitter<void>();

  ngAfterViewInit() {
    this.previous = this.document.activeElement as HTMLElement | null;
    this.timer = setTimeout(() => (this.focusable()[0] ?? this.element.nativeElement).focus());
  }

  private focusable(): HTMLElement[] {
    return Array.from(this.element.nativeElement.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
    )).filter(el => !el.closest('[inert]') && el.getClientRects().length > 0);
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); this.dialogEscape.emit();
    }
    if (event.key !== 'Tab') return;
    const items = this.focusable();
    const first = items[0], last = items.at(-1);
    if (!first) { event.preventDefault(); this.element.nativeElement.focus(); return; }
    if (event.shiftKey && (this.document.activeElement === first || this.document.activeElement === this.element.nativeElement)) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }

  ngOnDestroy() {
    clearTimeout(this.timer);
    if (this.previous?.isConnected) this.previous.focus();
  }
}
