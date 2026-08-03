import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../../core/services/state.service';
import { Product } from '../../../core/models/types';
import { FeedbackModalComponent } from '../../../core/components/feedback-modal/feedback-modal.component';

@Component({
  selector: 'app-almacen-inventario',
  imports: [CommonModule, FormsModule, FeedbackModalComponent],
  templateUrl: './almacen-inventario.component.html',
  styleUrl: './almacen-inventario.component.scss',
  standalone: true
})
export class AlmacenInventarioComponent implements OnInit {
  private stateService = inject(StateService);

  products: Product[] = [];
  selectedProduct: Product | null = null;

  // Modals state
  showEditModal = false;

  // Edit Product Form (Add Stock Only)
  editProdAddStock = 0;

  // Feedback Modal State
  showFeedbackModal = false;
  feedbackTitle = '';
  feedbackMessage = '';
  feedbackTone: 'info' | 'success' | 'warning' | 'error' = 'info';
  private feedbackAfterClose: (() => void) | null = null;

  ngOnInit() {
    this.stateService.products$.subscribe(p => this.products = p);
  }

  formatCurrency(value: number): string {
    return `Bs. ${value.toFixed(2)}`;
  }

  openFeedbackModal(title: string, message: string, tone: 'info' | 'success' | 'warning' | 'error' = 'info', afterClose?: () => void) {
    this.feedbackTitle = title;
    this.feedbackMessage = message;
    this.feedbackTone = tone;
    this.feedbackAfterClose = afterClose || null;
    this.showFeedbackModal = true;
  }

  closeFeedbackModal() {
    this.showFeedbackModal = false;
    const afterClose = this.feedbackAfterClose;
    this.feedbackAfterClose = null;
    afterClose?.();
  }

  openEditModal(product: Product) {
    this.selectedProduct = product;
    this.editProdAddStock = 0; // Initial quantity to add
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.selectedProduct = null;
  }

  saveEditProduct() {
    if (!this.selectedProduct) return;

    if (this.editProdAddStock <= 0 || !Number.isInteger(this.editProdAddStock)) {
      this.openFeedbackModal('Cantidad inválida', 'Por favor introduce una cantidad entera mayor a 0 para agregar.', 'warning');
      return;
    }

    // Apply stock adjustment
    this.stateService.updateProductStock(this.selectedProduct.id, this.editProdAddStock);

    this.closeEditModal();
    this.openFeedbackModal('Stock Incrementado', 'Se ha registrado la producción e incrementado el inventario.', 'success');
  }
}
