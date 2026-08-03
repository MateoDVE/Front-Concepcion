import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { StateService } from '../../../core/services/state.service';
import { Product } from '../../../core/models/types';
import { FeedbackModalComponent } from '../../../core/components/feedback-modal/feedback-modal.component';

@Component({
  selector: 'app-admin-inventario',
  imports: [CommonModule, FormsModule, FeedbackModalComponent],
  templateUrl: './admin-inventario.component.html',
  styleUrl: './admin-inventario.component.scss',
  standalone: true
})
export class AdminInventarioComponent implements OnInit {
  private stateService = inject(StateService);

  products: Product[] = [];
  selectedProduct: Product | null = null;

  // Modals state
  showAddModal = false;
  showEditModal = false;

  // Add Product Form
  newProdName = '';
  newProdPrice = 0;
  newProdStock = 0;
  newProdUnit = 'bidon';

  // Edit Product Form
  editProdPrice = 0;
  editProdAddStock = 0;

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

  openAddModal() {
    this.newProdName = '';
    this.newProdPrice = 0;
    this.newProdStock = 0;
    this.newProdUnit = 'bidon';
    this.showAddModal = true;
  }

  closeAddModal() {
    this.showAddModal = false;
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
  saveProduct(form?: NgForm) {
    if (form && form.invalid) {
      this.openFeedbackModal('Campos inválidos', 'Por favor corrige los errores en el formulario antes de guardar.', 'warning');
      return;
    }

    if (!this.newProdName.trim() || this.newProdPrice <= 0 || this.newProdStock < 0) {
      this.openFeedbackModal('Campos inválidos', 'Por favor completa los campos con valores válidos (precio > 0, stock >= 0).', 'warning');
      return;
    }

    this.stateService.addProduct(
      this.newProdName.trim(),
      this.newProdPrice,
      this.newProdStock,
      this.newProdUnit
    );

    this.closeAddModal();
    this.openFeedbackModal('Producto registrado', 'Producto registrado con éxito.', 'success');
  }

  openEditModal(product: Product) {
    this.selectedProduct = product;
    this.editProdPrice = product.basePrice;
    this.editProdAddStock = 0; // Quantity to ADD
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.selectedProduct = null;
  }

  saveEditProduct() {
    if (!this.selectedProduct) return;

    if (this.editProdPrice <= 0) {
      this.openFeedbackModal('Precio inválido', 'Por favor introduce un precio base válido.', 'warning');
      return;
    }

    // Apply price change if modified
    if (this.editProdPrice !== this.selectedProduct.basePrice) {
      this.stateService.updateProductBasePrice(this.selectedProduct.id, this.editProdPrice);
    }

    // Apply stock adjustment if non-zero
    if (this.editProdAddStock !== 0) {
      this.stateService.updateProductStock(this.selectedProduct.id, this.editProdAddStock);
    }

    this.closeEditModal();
    this.openFeedbackModal('Inventario actualizado', 'Inventario actualizado con éxito.', 'success');
  }
}
