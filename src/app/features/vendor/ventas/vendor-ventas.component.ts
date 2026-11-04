import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DialogFocusDirective } from '../../../core/directives/dialog-focus.directive';
import { Observable, finalize } from 'rxjs';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../../core/services/state.service';
import { Order, Vendor, OrderStatus, Client, Product } from '../../../core/models/types';
import { FormsModule } from '@angular/forms';
import { FeedbackModalComponent } from '../../../core/components/feedback-modal/feedback-modal.component';
import { DecimalInputDirective } from '../../../core/directives/decimal-input.directive';

@Component({
  selector: 'app-vendor-ventas',
  imports: [DialogFocusDirective, CommonModule, FormsModule, FeedbackModalComponent, DecimalInputDirective],
  templateUrl: './vendor-ventas.component.html',
  styleUrl: './vendor-ventas.component.scss',
  standalone: true
})
export class VendorVentasComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private stateService = inject(StateService);
  saving = false;
  private save(request: Observable<unknown>, onSuccess: () => void) {
    if (this.saving) return;
    this.saving = true;
    request.pipe(finalize(() => this.saving = false)).subscribe({
      next: () => { this.saving = false; onSuccess(); },
      error: () => this.openFeedbackModal('No se pudo guardar',
        'El servidor no confirmó la operación. Conservamos tus datos; revisa la conexión y los registros antes de reintentar.', 'error')
    });
  }

  activeVendor: Vendor | null = null;
  clients: Client[] = [];
  products: Product[] = [];

  // Client Autocomplete Search Properties
  clientSearchQuery = '';
  filteredClients: Client[] = [];
  showClientDropdown = false;

  // Modal Control Flags
  showRegisterClientModal = false;

  // Form Fields for Register Client
  newClientName = '';
  newClientPhone = '';
  newClientAddress = '';
  newClientLocationUrl = '';

  // Form Fields for Edit Client
  showEditClientModal = false;
  editClientName = '';
  editClientPhone = '';
  editClientAddress = '';
  editClientLocationUrl = '';

  // Form Fields for Direct Sale
  description = '';
  scheduledDate = this.stateService.getLocalDateString();
  selectedClientId = '';
  selectedProductId = '';
  productQuantity = 1;
  productPrice = 0;
  selectedPaymentMethod: 'efectivo' | 'qr' = 'efectivo';
  saleItems: { product: Product; quantity: number; price: number }[] = [];

  showFeedbackModal = false;
  feedbackTitle = '';
  feedbackMessage = '';
  feedbackTone: 'info' | 'success' | 'warning' | 'error' = 'info';
  private feedbackAfterClose: (() => void) | null = null;

  ngOnInit() {
    this.stateService.activeVendor$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(av => {
      this.activeVendor = av;
    });

    this.stateService.clients$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(cls => {
      this.clients = cls;
      this.filterClients();
    });

    this.stateService.products$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(prods => {
      this.products = prods;
    });
  }

  formatCurrency(value: number): string {
    return `Bs. ${value.toFixed(2)}`;
  }

  // ---- Register Client Modal Flow ----
  openRegisterClientModal() {
    this.newClientName = '';
    this.newClientPhone = '';
    this.newClientAddress = '';
    this.newClientLocationUrl = '';
    this.showRegisterClientModal = true;
  }

  closeRegisterClientModal() {
    this.showRegisterClientModal = false;
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

  registerClient() {
    if (!this.newClientName.trim() || !this.newClientPhone.trim() || !this.newClientAddress.trim()) {
      this.openFeedbackModal('Campos obligatorios', 'Por favor complete todos los campos obligatorios: Nombre, Teléfono y Dirección.', 'warning');
      return;
    }
    this.save(this.stateService.addClient(
      this.newClientName,
      this.newClientPhone,
      this.newClientAddress,
      this.newClientLocationUrl
    ), () => {
    this.closeRegisterClientModal();
    this.openFeedbackModal('Cliente registrado', 'Cliente registrado con éxito.', 'success');
    });
  }

  openEditClientModal() {
    if (!this.selectedClientId) return;
    const client = this.clients.find(c => c.id === this.selectedClientId);
    if (!client) return;

    this.editClientName = client.name;
    this.editClientPhone = client.phone;
    this.editClientAddress = client.address;
    this.editClientLocationUrl = client.locationUrl || '';
    this.showEditClientModal = true;
  }

  closeEditClientModal() {
    this.showEditClientModal = false;
  }

  saveEditClient() {
    if (this.saving) return;
    if (!this.selectedClientId) return;
    if (!this.editClientName.trim() || !this.editClientPhone.trim() || !this.editClientAddress.trim()) {
      this.openFeedbackModal('Campos obligatorios', 'Por favor complete todos los campos obligatorios: Nombre, Teléfono y Dirección.', 'warning');
      return;
    }

    const mapUrl = this.editClientLocationUrl.trim() || `https://maps.google.com/?q=${encodeURIComponent(this.editClientAddress.trim())}`;

    this.saving = true;
    this.stateService.updateClient(this.selectedClientId, {
      name: this.editClientName.trim(),
      phone: this.editClientPhone.trim(),
      address: this.editClientAddress.trim(),
      locationUrl: mapUrl
    }).pipe(finalize(() => this.saving = false)).subscribe({
      next: (updatedClient) => {
        this.clientSearchQuery = updatedClient.name;
        this.closeEditClientModal();
        this.openFeedbackModal('Cliente actualizado', 'Datos del cliente actualizados con éxito.', 'success');
      },
      error: (err) => {
        console.error('Error al actualizar cliente:', err);
        this.openFeedbackModal('Error', 'No se pudo actualizar los datos del cliente.', 'error');
      }
    });
  }

  // ---- Direct Sale (Venta Directa) Flow ----
  onClientOrProductChange() {
    if (this.selectedClientId && this.selectedProductId) {
      this.productPrice = this.stateService.getLastPriceApplied(this.selectedClientId, this.selectedProductId);
    } else {
      this.productPrice = 0;
    }
  }

  addProductToSale() {
    if (!this.selectedProductId) {
      this.openFeedbackModal('Producto requerido', 'Por favor seleccione un producto.', 'warning');
      return;
    }
    if (!Number.isInteger(this.productQuantity) || this.productQuantity <= 0) {
      this.openFeedbackModal('Cantidad inválida', 'La cantidad debe ser mayor que cero.', 'warning');
      return;
    }

    const product = this.products.find(p => p.id === this.selectedProductId);
    if (!product) return;

    const priceVal = Number(this.productPrice);
    if (this.productPrice === null || !Number.isFinite(priceVal) || priceVal < 0) {
      this.openFeedbackModal('Precio inválido', 'Introduce un precio mayor o igual a cero.', 'warning'); return;
    }
    const existingItem = this.saleItems.find(item => item.product.id === product.id);
    if (existingItem) {
      existingItem.quantity += this.productQuantity;
      existingItem.price = priceVal;
    } else {
      this.saleItems.push({
        product,
        quantity: this.productQuantity,
        price: priceVal
      });
    }

    // Reset selection inputs
    this.selectedProductId = '';
    this.productQuantity = 1;
    this.productPrice = 0;
  }

  removeProductFromSale(index: number) {
    this.saleItems.splice(index, 1);
  }

  getSaleTotal(): number {
    return this.saleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  }

  submitDirectSale(status: 'pending' | 'delivered') {
    if (this.description.length > 1000) {
      this.openFeedbackModal('Descripción demasiado larga', 'La descripción admite hasta 1.000 caracteres.', 'warning');
      return;
    }
    if (!this.selectedClientId) {
      this.openFeedbackModal('Cliente requerido', 'Por favor seleccione un cliente.', 'warning');
      return;
    }
    if (this.saleItems.length === 0) {
      this.openFeedbackModal('Venta incompleta', 'Debe agregar al menos un producto a la venta.', 'warning');
      return;
    }
    if (!this.activeVendor) {
      this.openFeedbackModal('Perfil no disponible', 'No se encuentra un perfil de vendedor activo.', 'error');
      return;
    }

    if (status === 'pending' && !/^\d{4}-\d{2}-\d{2}$/.test(this.scheduledDate)) {
      this.openFeedbackModal('Fecha requerida', 'Selecciona una fecha válida para el pedido.', 'warning'); return;
    }
    const orderData = {
      scheduledDate: status === 'pending' ? this.scheduledDate : this.stateService.getLocalDateString(),
      description: this.description.trim() || null,
      clientId: this.selectedClientId,
      vendorId: this.activeVendor.id,
      status: status,
      paymentMethod: status === 'delivered' ? this.selectedPaymentMethod : undefined,
      items: this.saleItems.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.price
      }))
    };

    this.save(this.stateService.createOrder(orderData), () => {
    const isVenta = status === 'delivered';
    const messageTitle = isVenta ? 'Venta registrada' : 'Pedido registrado';
    const messageContent = isVenta 
      ? `Venta directa registrada con éxito (${this.selectedPaymentMethod === 'qr' ? 'Pago QR' : 'Pago Efectivo'}).` 
      : 'Pedido directo registrado con éxito como pendiente.';

    this.openFeedbackModal(messageTitle, messageContent, 'success', () => {
      this.description = '';
      this.scheduledDate = this.stateService.getLocalDateString();
      this.selectedClientId = '';
      this.clientSearchQuery = '';
      this.selectedProductId = '';
      this.productQuantity = 1;
      this.productPrice = 0;
      this.selectedPaymentMethod = 'efectivo';
      this.saleItems = [];
      this.filterClients();
    });
    });
  }

  filterClients() {
    const query = this.clientSearchQuery.toLowerCase().trim();
    if (!query) {
      this.filteredClients = this.clients;
    } else {
      this.filteredClients = this.clients.filter(c => 
        c.name.toLowerCase().includes(query) || 
        c.address.toLowerCase().includes(query) ||
        c.phone.includes(query)
      );
    }
  }

  selectClient(client: Client) {
    this.selectedClientId = client.id;
    this.clientSearchQuery = client.name;
    this.showClientDropdown = false;
    this.onClientOrProductChange();
  }
}
