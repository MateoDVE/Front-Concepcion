import { finalize, take, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { StateService } from '../../../core/services/state.service';
import { Client, Product, Vendor, Order, OrderItem } from '../../../core/models/types';
import { FeedbackModalComponent } from '../../../core/components/feedback-modal/feedback-modal.component';
import { DecimalInputDirective } from '../../../core/directives/decimal-input.directive';

interface OrderFormItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  basePrice: number;
}

@Component({
  selector: 'app-admin-crear-pedido',
  imports: [CommonModule, FormsModule, RouterLink, FeedbackModalComponent, DecimalInputDirective],
  templateUrl: './admin-crear-pedido.component.html',
  styleUrl: './admin-crear-pedido.component.scss',
  standalone: true
})
export class AdminCrearPedidoComponent implements OnInit {
  private stateService = inject(StateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private destroyRef = inject(DestroyRef);
  private orderLoad?: Subscription;
  private originalOrder: Order | null = null;
  saving = false;
  loadingOrder = false;
  loadError = false;

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
  description = '';
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
    this.stateService.clients$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(c => this.clients = c);
    this.stateService.products$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(p => this.products = p);
    this.stateService.vendors$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(v => {
      this.vendors = v.filter(vendor => vendor.active !== false);
      if (this.vendors.length > 0 && !this.selectedVendorId && !this.originalOrder && !this.loadingOrder) {
        this.selectedVendorId = this.vendors[0].id;
      }
    });

    // Default delivery date to today
    const today = this.stateService.getLocalDateString();
    this.deliveryDate = today;

    // Check query params for edit/reopen
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const orderId = params['orderId'];
      const reopen = params['reopen'] === 'true';

      if (orderId) {
        this.loadOrderData(orderId, reopen);
      }
    });
  }

  get retainedVendorName(): string | null {
    return this.selectedVendorId && !this.vendors.some(v => v.id === this.selectedVendorId)
      ? this.originalOrder?.vendorName || 'Vendedor asignado' : null;
  }

  get isDeliveredOrder(): boolean { return this.isEditing && this.originalOrder?.status === 'delivered'; }

  loadOrderData(orderId: string, reopen: boolean) {
    this.orderLoad?.unsubscribe();
    this.loadingOrder = true;
    this.loadError = false;
    this.orderLoad = this.stateService.fetchOrder(orderId).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingOrder = false)
    ).subscribe({ next: (order) => {
      this.originalOrder = order;
      this.selectedClient = this.clients.find(c => c.id === order.clientId) || {
        id: order.clientId, name: order.clientName, phone: order.clientPhone || '',
        address: order.clientAddress || '', locationUrl: order.clientLocationUrl || ''
      };
      if (this.selectedClient) {
        this.searchClientQuery = this.selectedClient.name;
        this.stateService.loadSpecialPricesForClient(this.selectedClient.id).subscribe({ error: () => {} });
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
      this.description = order.description || '';
      
      if (reopen) {
        this.isReopening = true;
        this.isEditing = false;
        // set date to today for reopening
        this.deliveryDate = this.stateService.getLocalDateString();
      } else {
        this.isEditing = true;
        this.isReopening = false;
        this.editingOrderId = order.id;
        if (order.createdAt) {
          this.deliveryDate = this.stateService.getOrderDate(order);
        }
      }

      this.calculateTotal();
    }, error: () => {
      this.loadError = true;
      this.openFeedbackModal('No se pudo cargar el pedido', 'Vuelve a abrir el pedido para reintentar. Los datos no se han modificado.', 'error');
    }});
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
        if (this.selectedClient?.id !== client.id) return;
        this.orderItems.forEach(item => {
          const suggestedPrice = this.stateService.getLastPriceApplied(client.id, item.productId);
          item.price = suggestedPrice;
        });
        this.calculateTotal();
      },
      error: (err) => {
        if (this.selectedClient?.id !== client.id) return;
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
    this.orderTotal = this.orderItems.reduce((sum, item) => sum + ((Number(item.price) || 0) * item.quantity), 0);
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
    if (this.saving || this.loadingOrder || this.loadError) return;
    if (this.description.length > 1000) {
      this.openFeedbackModal('Descripción demasiado larga', 'La descripción admite hasta 1.000 caracteres.', 'warning');
      return;
    }
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
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        this.openFeedbackModal('Cantidad inválida', `La cantidad para ${item.name} debe ser mayor a 0.`, 'warning');
        return;
      }
      const priceNum = Number(item.price);
      if (item.price === null || !Number.isFinite(priceNum) || priceNum < 0) {
        this.openFeedbackModal('Precio inválido', `El precio para ${item.name} no puede ser negativo.`, 'warning');
        return;
      }
    }

    // One product per order detail: combine repeated rows without changing prices.
    const itemsByProduct = new Map<string, OrderFormItem>();
    for (const item of this.orderItems) {
      const existing = itemsByProduct.get(item.productId);
      if (existing) {
        if (Number(existing.price) !== Number(item.price)) {
          this.openFeedbackModal('Producto con precios distintos',
            `${item.name} aparece varias veces con precios diferentes. Usa un mismo precio para ese producto antes de guardar.`, 'warning');
          return;
        }
        existing.quantity += item.quantity;
      } else {
        itemsByProduct.set(item.productId, { ...item });
      }
    }
    this.orderItems = [...itemsByProduct.values()];
    this.calculateTotal();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.deliveryDate) || !Number.isFinite(Date.parse(this.deliveryDate))) {
      this.openFeedbackModal('Fecha requerida', 'Selecciona una fecha de entrega válida.', 'warning');
      return;
    }
    const assignedVendor = this.vendors.find(v => v.id === this.selectedVendorId);

    const orderData = {
      description: this.description.trim() || null,
      scheduledDate: this.deliveryDate,
      clientId: this.selectedClient.id,
      clientName: this.selectedClient.name,
      vendorId: this.selectedVendorId || null,
      vendorName: assignedVendor?.name ?? this.originalOrder?.vendorName ?? null,
      status: 'pending' as const,
      items: this.orderItems.map(item => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: Number(item.price) || 0
      })),
      total: this.orderTotal
    };

    this.saving = true;
    const request = this.isEditing && this.editingOrderId && this.originalOrder
      ? this.stateService.updateOrder({ ...this.originalOrder, ...orderData,
          status: this.originalOrder.status, paymentMethod: this.originalOrder.paymentMethod })
      : this.stateService.createOrder(orderData);
    request.pipe(finalize(() => this.saving = false)).subscribe({
      next: () => this.openFeedbackModal(
        this.isEditing ? 'Pedido actualizado' : 'Pedido registrado',
        'Los datos se guardaron correctamente.', 'success',
        () => this.router.navigate(['/admin/dashboard'])),
      error: (error) => {
        const message = error?.error?.message;
        this.openFeedbackModal('No se pudo guardar',
          error?.status === 400 && message
            ? (Array.isArray(message) ? message.join('. ') : message)
            : 'El servidor no confirmó el guardado. Conservamos tus datos; comprueba la conexión y revisa los pedidos antes de reintentar.', 'error');
      }
    });
  }

  formatCurrency(value: number): string {
    return `Bs. ${value.toFixed(2)}`;
  }
}
