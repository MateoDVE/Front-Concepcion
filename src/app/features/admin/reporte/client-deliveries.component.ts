import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Client, Order } from '../../../core/models/types';

const deliveryDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit'
});

function deliveryDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = deliveryDateFormatter.formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}

@Component({
  selector: 'app-client-deliveries',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './client-deliveries.component.html',
  styleUrl: './client-deliveries.component.scss'
})
export class ClientDeliveriesComponent implements OnChanges {
  @Input() orders: Order[] = [];
  @Input() clients: Client[] = [];
  selectedMonth = deliveryDate(new Date().toISOString()).slice(0, 7);
  selectedClientId = '';
  clientOptions: { id: string; name: string; phone?: string }[] = [];
  deliveries: { order: Order; date: string }[] = [];
  productTotals: { id: string; name: string; quantity: number }[] = [];

  ngOnChanges(): void {
    const clients = new Map(this.clients.map(client => [client.id, {
      id: client.id, name: client.name, phone: client.phone
    }]));
    for (const order of this.orders) {
      if (!clients.has(order.clientId)) {
        clients.set(order.clientId, { id: order.clientId, name: order.clientName, phone: order.clientPhone || '' });
      }
    }
    this.clientOptions = [...clients.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    this.updateReport();
  }

  updateReport(): void {
    this.deliveries = this.orders
      .filter(order => order.status === 'delivered' && order.clientId === this.selectedClientId && order.deliveredAt)
      .map(order => ({ order, date: deliveryDate(order.deliveredAt!) }))
      .filter(entry => !!this.selectedMonth && !!entry.date && entry.date.slice(0, 7) === this.selectedMonth)
      .sort((a, b) => b.order.deliveredAt!.localeCompare(a.order.deliveredAt!));

    const products = new Map<string, { id: string; name: string; quantity: number }>();
    for (const { order } of this.deliveries) {
      for (const item of order.items) {
        const product = products.get(item.productId) || { id: item.productId, name: item.name, quantity: 0 };
        product.quantity += item.quantity;
        products.set(item.productId, product);
      }
    }
    this.productTotals = [...products.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }
}
