import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../../core/services/state.service';
import { Order, Vendor, OrderStatus, Client, Product } from '../../../core/models/types';
import { FormsModule } from '@angular/forms';
import { FeedbackModalComponent } from '../../../core/components/feedback-modal/feedback-modal.component';

@Component({
  selector: 'app-vendor-ventas',
  imports: [CommonModule, FormsModule, FeedbackModalComponent],
  templateUrl: './vendor-ventas.component.html',
  styleUrl: './vendor-ventas.component.scss',
  standalone: true
})
export class VendorVentasComponent implements OnInit {
  private stateService = inject(StateService);

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

  // Form Fields for Direct Sale
  selectedClientId = '';
  selectedProductId = '';
  productQuantity = 1;
  productPrice = 0;
  saleItems: { product: Product; quantity: number; price: number }[] = [];

  showFeedbackModal = false;
  feedbackTitle = '';
  feedbackMessage = '';
  feedbackTone: 'info' | 'success' | 'warning' | 'error' = 'info';
  private feedbackAfterClose: (() => void) | null = null;

  ngOnInit() {
    this.stateService.activeVendor$.subscribe(av => {
      this.activeVendor = av;
    });

    this.stateService.clients$.subscribe(cls => {
      this.clients = cls;
      this.filterClients();
    });

    this.stateService.products$.subscribe(prods => {
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
    this.stateService.addClient(
      this.newClientName,
      this.newClientPhone,
      this.newClientAddress,
      this.newClientLocationUrl
    );
    this.closeRegisterClientModal();
    this.openFeedbackModal('Cliente registrado', 'Cliente registrado con éxito.', 'success');
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
    if (this.productQuantity <= 0) {
      this.openFeedbackModal('Cantidad inválida', 'La cantidad debe ser mayor que cero.', 'warning');
      return;
    }

    const product = this.products.find(p => p.id === this.selectedProductId);
    if (!product) return;

    const existingItem = this.saleItems.find(item => item.product.id === product.id);
    if (existingItem) {
      existingItem.quantity += this.productQuantity;
      existingItem.price = this.productPrice;
    } else {
      this.saleItems.push({
        product,
        quantity: this.productQuantity,
        price: this.productPrice
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

    const orderData = {
      clientId: this.selectedClientId,
      vendorId: this.activeVendor.id,
      status: status,
      items: this.saleItems.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.price
      }))
    };

    this.stateService.createOrder(orderData);
    const isVenta = status === 'delivered';
    const messageTitle = isVenta ? 'Venta registrada' : 'Pedido registrado';
    const messageContent = isVenta ? 'Venta directa registrada con éxito.' : 'Pedido directo registrado con éxito como pendiente.';

    this.openFeedbackModal(messageTitle, messageContent, 'success', () => {
      this.selectedClientId = '';
      this.clientSearchQuery = '';
      this.selectedProductId = '';
      this.productQuantity = 1;
      this.productPrice = 0;
      this.saleItems = [];
      this.filterClients();
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
