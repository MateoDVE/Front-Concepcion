import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { StateService } from '../../../core/services/state.service';
import { AuthService } from '../../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { Vendor } from '../../../core/models/types';

@Component({
  selector: 'app-vendor-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './vendor-layout.component.html',
  styleUrl: './vendor-layout.component.scss',
  standalone: true
})
export class VendorLayoutComponent implements OnInit {
  stateService = inject(StateService);
  private router = inject(Router);
  private authService = inject(AuthService);

  vendors: Vendor[] = [];
  activeVendor: Vendor | null = null;
  showVendorSelector = false;

  ngOnInit() {
    this.stateService.vendors$.subscribe(v => this.vendors = v);
    this.stateService.activeVendor$.subscribe(av => this.activeVendor = av);
  }

  toggleSelector() {
    this.showVendorSelector = !this.showVendorSelector;
  }

  selectVendor(vendor: Vendor) {
    this.stateService.setActiveVendor(vendor);
    this.showVendorSelector = false;
    // Reload page/view to update deliveries
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate(['/vendor/ruta']);
    });
  }

  resetData() {
    if (confirm('¿Reiniciar datos del vendedor?')) {
      this.stateService.resetData();
      alert('Datos locales reiniciados');
      location.reload();
    }
  }

  logout() {
    this.authService.signOut().subscribe(() => {
      this.router.navigate(['/']);
    });
  }
}
