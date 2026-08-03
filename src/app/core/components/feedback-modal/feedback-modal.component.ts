import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

type FeedbackTone = 'info' | 'success' | 'warning' | 'error';

@Component({
  selector: 'app-feedback-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop-wrap animate-fade-in" *ngIf="open">
      <div class="modal-backdrop-overlay" (click)="closed.emit()"></div>

      <div class="modal-card animate-slide-up feedback-modal" [ngClass]="toneClass" role="dialog" aria-modal="true">
        <div class="modal-header mb-4">
          <div class="feedback-modal__header-copy">
            <span class="feedback-modal__icon material-symbols-outlined">{{ iconName }}</span>
            <div>
              <h3 class="text-headline-md font-bold text-primary">{{ title }}</h3>
              <p *ngIf="subtitle" class="text-body-sm text-muted">{{ subtitle }}</p>
            </div>
          </div>
          <button class="modal-close-btn" (click)="closed.emit()" aria-label="Cerrar mensaje">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="modal-body space-y-3">
          <p class="text-body-md text-primary font-medium">{{ message }}</p>
        </div>

        <div class="modal-footer mt-6">
          <button class="btn btn--primary btn--full" (click)="closed.emit()">{{ actionLabel }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop-wrap {
      position: fixed;
      inset: 0;
      z-index: 3000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: clamp(1rem, 4vh, 2rem);
    }

    .modal-backdrop-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
    }

    .modal-card {
      position: relative;
      width: 100%;
      max-width: 420px;
      max-height: calc(100vh - 2rem);
      overflow-y: auto;
      margin: auto;
      z-index: 1;
      pointer-events: auto;
      background-color: #ffffff !important;
      padding: 1.5rem !important;
      border-radius: 1rem;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
      border: 1px solid rgba(0, 0, 0, 0.08);
      display: block !important;
    }

    .modal-footer {
      position: relative;
      z-index: 2;
    }

    .modal-footer .btn {
      width: 100%;
    }

    .feedback-modal__header-copy {
      align-items: center;
      display: flex;
      gap: 0.75rem;
      min-width: 0;
    }

    .feedback-modal__icon {
      align-items: center;
      border-radius: 9999px;
      display: inline-flex;
      height: 2.5rem;
      justify-content: center;
      width: 2.5rem;
      flex-shrink: 0;
    }

    .feedback-modal--info .feedback-modal__icon {
      background: rgba(59, 130, 246, 0.12);
      color: #2563eb;
    }

    .feedback-modal--success .feedback-modal__icon {
      background: rgba(34, 197, 94, 0.12);
      color: #16a34a;
    }

    .feedback-modal--warning .feedback-modal__icon {
      background: rgba(245, 158, 11, 0.12);
      color: #d97706;
    }

    .feedback-modal--error .feedback-modal__icon {
      background: rgba(239, 68, 68, 0.12);
      color: #dc2626;
    }
  `]
})
export class FeedbackModalComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() message = '';
  @Input() subtitle = '';
  @Input() actionLabel = 'Entendido';
  @Input() tone: FeedbackTone = 'info';

  @Output() closed = new EventEmitter<void>();

  get iconName(): string {
    switch (this.tone) {
      case 'success':
        return 'check_circle';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'info';
    }
  }

  get toneClass(): string {
    return `feedback-modal--${this.tone}`;
  }
}