import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { StateService } from '../../../core/services/state.service';
import { Client, Product, Vendor, Order, OrderItem } from '../../../core/models/types';
import { FeedbackModalComponent } from '../../../core/components/feedback-modal/feedback-modal.component';

interface OrderFormItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  basePrice: number;
}

@Component({
  selector: 'app-admin-crear-pedido',
  imports: [CommonModule, FormsModule, RouterLink, FeedbackModalComponent],
  templateUrl: './admin-crear-pedido.component.html',
  styleUrl: './admin-crear-pedido.component.scss',
  standalone: true
})
export class AdminCrearPedidoComponent implements OnInit {
  private stateService = inject(StateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Catalogs
  clients: Client[] = [];
  products: Product[] = [];
  vendors: Vendor[] = [];

  // Form State
  searchClientQuery = '';
  filteredClients: Client[] = [];
  selectedClient: Client | null = null;
  showClientSuggestions = false;

  orderItems: OrderFormItem[] = [];
  selectedVendorId = '';
  deliveryDate = '';
  orderTotal = 0;

  // Edit / Reopen State
  isEditing = false;
  isReopening = false;
  editingOrderId: string | null = null;
  showFeedbackModal = false;
  feedbackTitle = '';
  feedbackMessage = '';
  feedbackTone: 'info' | 'success' | 'warning' | 'error' = 'info';
  private feedbackAfterClose: (() => void) | null = null;

  ngOnInit() {
    this.stateService.clients$.subscribe(c => this.clients = c);
    this.stateService.products$.subscribe(p => this.products = p);
    this.stateService.vendors$.subscribe(v => {
      this.vendors = v;
      if (this.vendors.length > 0 && !this.selectedVendorId) {
        this.selectedVendorId = this.vendors[0].id;
      }
    });

    // Default delivery date to today
    const today = new Date().toISOString().split('T')[0];
    this.deliveryDate = today;

    // Check query params for edit/reopen
    this.route.queryParams.subscribe(params => {
      const orderId = params['orderId'];
      const reopen = params['reopen'] === 'true';

      if (orderId) {
        this.loadOrderData(orderId, reopen);
      }
    });
  }

  loadOrderData(orderId: string, reopen: boolean) {
    this.stateService.orders$.subscribe(orders => {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      this.selectedClient = this.clients.find(c => c.id === order.clientId) || null;
      if (this.selectedClient) {
        this.searchClientQuery = this.selectedClient.name;
        this.stateService.loadSpecialPricesForClient(this.selectedClient.id).subscribe();
      }

      this.orderItems = order.items.map(item => {
        const prod = this.products.find(p => p.id === item.productId);
        return {
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          basePrice: prod ? prod.basePrice : item.price
        };
      });

      this.selectedVendorId = order.vendorId || '';
      
      if (reopen) {
        this.isReopening = true;
        this.isEditing = false;
        // set date to today for reopening
        this.deliveryDate = new Date().toISOString().split('T')[0];
      } else {
        this.isEditing = true;
        this.isReopening = false;
        this.editingOrderId = order.id;
        if (order.createdAt) {
          this.deliveryDate = order.createdAt.split('T')[0];
        }
      }

      this.calculateTotal();
    });
  }

  // ---- Client Search & Selection ----
  onClientSearchChange() {
    if (!this.searchClientQuery.trim()) {
      this.filteredClients = [];
      this.showClientSuggestions = false;
      return;
    }

    const q = this.searchClientQuery.toLowerCase();
    this.filteredClients = this.clients.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.phone.includes(q)
    );
    this.showClientSuggestions = this.filteredClients.length > 0;
  }

  selectClient(client: Client) {
    this.selectedClient = client;
    this.searchClientQuery = client.name;
    this.showClientSuggestions = false;

    // Recompute prices for all existing items since the client changed,
    // first fetching special prices asynchronously to sync cache.
    this.stateService.loadSpecialPricesForClient(client.id).subscribe({
      next: () => {
        this.orderItems.forEach(item => {
          const suggestedPrice = this.stateService.getLastPriceApplied(client.id, item.productId);
          item.price = suggestedPrice;
        });
        this.calculateTotal();
      },
      error: (err) => {
        console.error('Error al cargar precios especiales:', err);
        // Fallback simple si la carga falla
        this.orderItems.forEach(item => {
          const suggestedPrice = this.stateService.getLastPriceApplied(client.id, item.productId);
          item.price = suggestedPrice;
        });
        this.calculateTotal();
      }
    });
  }

  clearSelectedClient() {
    this.selectedClient = null;
    this.searchClientQuery = '';
    this.filteredClients = [];
  }

  // ---- Item Management ----
  addOrderItem() {
    if (this.products.length === 0) return;
    
    // Choose first product as default
    const defaultProduct = this.products[0];
    const price = this.selectedClient 
      ? this.stateService.getLastPriceApplied(this.selectedClient.id, defaultProduct.id)
      : defaultProduct.basePrice;

    this.orderItems.push({
      productId: defaultProduct.id,
      name: defaultProduct.name,
      quantity: 1,
      price: price,
      basePrice: defaultProduct.basePrice
    });

    this.calculateTotal();
  }

  removeOrderItem(index: number) {
    this.orderItems.splice(index, 1);
    this.calculateTotal();
  }

  onProductChange(index: number) {
    const item = this.orderItems[index];
    const prod = this.products.find(p => p.id === item.productId);
    if (!prod) return;

    item.name = prod.name;
    item.basePrice = prod.basePrice;

    // Apply rule 5.2: Propose last price paid by this client or fallback to base price
    if (this.selectedClient) {
      item.price = this.stateService.getLastPriceApplied(this.selectedClient.id, prod.id);
    } else {
      item.price = prod.basePrice;
    }

    this.calculateTotal();
  }

  calculateTotal() {
    this.orderTotal = this.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
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

  // ---- Save Form ----
  saveOrder() {
    if (!this.selectedClient) {
      this.openFeedbackModal('Cliente requerido', 'Por favor selecciona un cliente.', 'warning');
      return;
    }

    if (this.orderItems.length === 0) {
      this.openFeedbackModal('Pedido incompleto', 'Debes agregar al menos un producto al pedido.', 'warning');
      return;
    }

    // Validate quantities and prices
    for (const item of this.orderItems) {
      if (item.quantity <= 0) {
        this.openFeedbackModal('Cantidad inválida', `La cantidad para ${item.name} debe ser mayor a 0.`, 'warning');
        return;
      }
      if (item.price < 0) {
        this.openFeedbackModal('Precio inválido', `El precio para ${item.name} no puede ser negativo.`, 'warning');
        return;
      }
    }

    const assignedVendor = this.vendors.find(v => v.id === this.selectedVendorId);

    const orderData = {
      clientId: this.selectedClient.id,
      clientName: this.selectedClient.name,
      vendorId: assignedVendor ? assignedVendor.id : null,
      vendorName: assignedVendor ? assignedVendor.name : null,
      status: 'pending' as const,
      items: this.orderItems.map(item => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      total: this.orderTotal
    };

    if (this.isEditing && this.editingOrderId) {
      // Modifying existing order
      const updatedOrder: Order = {
        ...orderData,
        id: this.editingOrderId,
        createdAt: new Date().toISOString(),
        deliveredAt: null
      };
      this.stateService.updateOrder(updatedOrder);
      this.openFeedbackModal('Pedido actualizado', 'Pedido actualizado con éxito.', 'success', () => this.router.navigate(['/admin/dashboard']));
    } else {
      // Creating a new order (normal or reopened)
      this.stateService.createOrder(orderData);
      this.openFeedbackModal(
        this.isReopening ? 'Pedido reabierto' : 'Pedido registrado',
        this.isReopening ? 'Pedido reabierto y registrado con éxito.' : 'Pedido registrado con éxito.',
        'success',
        () => this.router.navigate(['/admin/dashboard'])
      );
    }
  }

  formatCurrency(value: number): string {
    return `Bs. ${value.toFixed(2)}`;
  }
}
