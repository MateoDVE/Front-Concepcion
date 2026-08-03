import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../../core/services/state.service';
import { Client, Order, OrderStatus, Product } from '../../../core/models/types';
import { map } from 'rxjs/operators';
import { FeedbackModalComponent } from '../../../core/components/feedback-modal/feedback-modal.component';

@Component({
  selector: 'app-admin-clientes',
  imports: [CommonModule, FormsModule, FeedbackModalComponent],
  templateUrl: './admin-clientes.component.html',
  styleUrl: './admin-clientes.component.scss',
  standalone: true
})
export class AdminClientesComponent implements OnInit {
  private stateService = inject(StateService);

  clients: Client[] = [];
  filteredClients: Client[] = [];
  selectedClient: Client | null = null;
  clientOrders: Order[] = [];
  specialPrices: any[] = [];
  products: Product[] = [];

  searchQuery = '';

  // Modals state
  showAddModal = false;
  showDetailModal = false;
  showDeleteSpecialPriceModal = false;
  pendingDeleteSpecialPriceProductId: string | null = null;
  showFeedbackModal = false;
  feedbackTitle = '';
  feedbackMessage = '';
  feedbackTone: 'info' | 'success' | 'warning' | 'error' = 'info';
  private feedbackAfterClose: (() => void) | null = null;

  // Special Prices Form State
  newSpecialPriceProductId = '';
  newSpecialPriceValue: number | null = null;

  // Add Client Form
  newClientName = '';
  newClientPhone = '';
  newClientAddress = '';
  newClientLocationUrl = '';
  newClientType = 'Particular';

  ngOnInit() {
    this.stateService.clients$.subscribe(c => {
      this.clients = c;
      this.applySearch();
    });
    this.stateService.products$.subscribe(p => {
      this.products = p;
    });
  }

  onSearchChange() {
    this.applySearch();
  }

  applySearch() {
    if (!this.searchQuery.trim()) {
      this.filteredClients = this.clients;
      return;
    }

    const q = this.searchQuery.toLowerCase();
    this.filteredClients = this.clients.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.phone.includes(q) ||
      c.address.toLowerCase().includes(q)
    );
  }

  getClientInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  formatCurrency(value: number): string {
    return `Bs. ${value.toFixed(2)}`;
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '--:--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-BO') + ' ' + d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  }

  getStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      pending: 'Pendiente',
      loaded: 'Cargado',
      route: 'En Ruta',
      delivered: 'Entregado',
      failed: 'No Entregado',
    };
    return labels[status] || status;
  }

  getStatusBadgeClass(status: OrderStatus): string {
    return `badge--${status}`;
  }

  openDetailModal(client: Client) {
    this.selectedClient = client;
    this.loadSpecialPrices(client.id);
    
    this.stateService.orders$.pipe(
      map(orders => orders.filter(o => o.clientId === client.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    ).subscribe(orders => {
      this.clientOrders = orders;
      this.showDetailModal = true;
    });
  }

  closeDetailModal() {
    this.showDetailModal = false;
    this.selectedClient = null;
    this.clientOrders = [];
    this.specialPrices = [];
    this.newSpecialPriceProductId = '';
    this.newSpecialPriceValue = null;
  }

  openAddModal() {
    this.newClientName = '';
    this.newClientPhone = '';
    this.newClientAddress = '';
    this.newClientLocationUrl = '';
    this.newClientType = 'Particular';
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

  saveClient() {
    if (!this.newClientName.trim() || !this.newClientPhone.trim() || !this.newClientAddress.trim()) {
      this.openFeedbackModal('Campos incompletos', 'Por favor completa los campos obligatorios.', 'warning');
      return;
    }

    // Default map location if empty
    const mapUrl = this.newClientLocationUrl.trim() || `https://maps.google.com/?q=${encodeURIComponent(this.newClientAddress)}`;

    this.stateService.addClient(
      this.newClientName.trim(),
      this.newClientPhone.trim(),
      this.newClientAddress.trim(),
      mapUrl,
      this.newClientType
    );

    this.closeAddModal();
    this.openFeedbackModal('Cliente registrado', 'Cliente registrado con éxito.', 'success');
  }

  loadSpecialPrices(clientId: string) {
    this.stateService.loadSpecialPricesForClient(clientId).subscribe({
      next: (prices) => {
        this.specialPrices = prices;
      },
      error: (err) => console.error('Error al cargar precios especiales:', err)
    });
  }

  getProductName(productId: string): string {
    const prod = this.products.find(p => p.id === productId);
    return prod ? prod.name : 'Producto Desconocido';
  }

  addSpecialPrice() {
    if (!this.selectedClient) return;
    if (!this.newSpecialPriceProductId) {
      this.openFeedbackModal('Producto requerido', 'Por favor selecciona un producto.', 'warning');
      return;
    }
    if (this.newSpecialPriceValue === null || this.newSpecialPriceValue < 0) {
      this.openFeedbackModal('Precio inválido', 'Por favor introduce un precio especial válido (mayor o igual a 0).', 'warning');
      return;
    }

    this.stateService.setClientSpecialPrice(
      this.selectedClient.id,
      this.newSpecialPriceProductId,
      this.newSpecialPriceValue
    ).subscribe({
      next: () => {
        const clientId = this.selectedClient!.id;
        this.loadSpecialPrices(clientId);
        this.newSpecialPriceProductId = '';
        this.newSpecialPriceValue = null;
        this.openFeedbackModal('Precio especial registrado', 'Precio especial registrado.', 'success');
      },
      error: (err) => {
        console.error('Error al guardar precio especial:', err);
        this.openFeedbackModal('Error', 'No se pudo registrar el precio especial.', 'error');
      }
    });
  }

  deleteSpecialPrice(productId: string) {
    if (!this.selectedClient) return;
    this.pendingDeleteSpecialPriceProductId = productId;
    this.showDeleteSpecialPriceModal = true;
  }

  cancelDeleteSpecialPrice() {
    this.showDeleteSpecialPriceModal = false;
    this.pendingDeleteSpecialPriceProductId = null;
  }

  confirmDeleteSpecialPrice() {
    if (!this.selectedClient || !this.pendingDeleteSpecialPriceProductId) return;
    const clientId = this.selectedClient.id;
    const productId = this.pendingDeleteSpecialPriceProductId;

    this.stateService.deleteClientSpecialPrice(clientId, productId).subscribe({
      next: () => {
        this.cancelDeleteSpecialPrice();
        this.loadSpecialPrices(clientId);
        this.openFeedbackModal('Precio especial eliminado', 'Precio especial eliminado.', 'success');
      },
      error: (err) => {
        console.error('Error al eliminar precio especial:', err);
        this.cancelDeleteSpecialPrice();
        this.openFeedbackModal('Error', 'No se pudo eliminar el precio especial.', 'error');
      }
    });
  }

  openMap(url: string) {
    window.open(url, '_blank');
  }
}
