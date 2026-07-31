import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../../core/services/state.service';
import { Client, Order, OrderStatus } from '../../../core/models/types';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-admin-clientes',
  imports: [CommonModule, FormsModule],
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

  searchQuery = '';

  // Modals state
  showAddModal = false;
  showDetailModal = false;

  // Add Client Form
  newClientName = '';
  newClientPhone = '';
  newClientAddress = '';
  newClientLocationUrl = '';

  ngOnInit() {
    this.stateService.clients$.subscribe(c => {
      this.clients = c;
      this.applySearch();
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
  }

  openAddModal() {
    this.newClientName = '';
    this.newClientPhone = '';
    this.newClientAddress = '';
    this.newClientLocationUrl = '';
    this.showAddModal = true;
  }

  closeAddModal() {
    this.showAddModal = false;
  }

  saveClient() {
    if (!this.newClientName.trim() || !this.newClientPhone.trim() || !this.newClientAddress.trim()) {
      alert('Por favor completa los campos obligatorios.');
      return;
    }

    // Default map location if empty
    const mapUrl = this.newClientLocationUrl.trim() || `https://maps.google.com/?q=${encodeURIComponent(this.newClientAddress)}`;

    this.stateService.addClient(
      this.newClientName.trim(),
      this.newClientPhone.trim(),
      this.newClientAddress.trim(),
      mapUrl
    );

    alert('Cliente registrado con éxito.');
    this.closeAddModal();
  }

  openMap(url: string) {
    window.open(url, '_blank');
  }
}
