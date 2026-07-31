import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../../core/services/state.service';
import { Product } from '../../../core/models/types';

@Component({
  selector: 'app-admin-inventario',
  imports: [CommonModule, FormsModule],
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

  saveProduct() {
    if (!this.newProdName.trim() || this.newProdPrice <= 0 || this.newProdStock < 0) {
      alert('Por favor completa los campos con valores válidos (precio > 0, stock >= 0).');
      return;
    }

    this.stateService.addProduct(
      this.newProdName.trim(),
      this.newProdPrice,
      this.newProdStock,
      this.newProdUnit
    );

    alert('Producto registrado con éxito.');
    this.closeAddModal();
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
      alert('Por favor introduce un precio base válido.');
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

    alert('Inventario actualizado con éxito.');
    this.closeEditModal();
  }
}
