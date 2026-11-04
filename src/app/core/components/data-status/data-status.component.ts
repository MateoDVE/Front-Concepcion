import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-data-status', standalone: true, imports: [CommonModule],
  template: `
    <aside *ngIf="state.loadErrors().length" class="data-status data-status--error" role="alert">
      <span>No se pudo actualizar: {{ state.loadErrors().join(', ') }}. La información puede estar incompleta.</span>
      <button type="button" class="btn btn--outline" [disabled]="state.loadingCount() > 0" (click)="state.initData()">Reintentar</button>
    </aside>
    <p *ngIf="state.loadingCount() > 0" class="data-status" role="status">Actualizando información…</p>
  `
})
export class DataStatusComponent { readonly state = inject(StateService); }
