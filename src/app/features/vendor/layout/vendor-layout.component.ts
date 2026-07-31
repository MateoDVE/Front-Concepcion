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

  activeVendor: Vendor | null = null;
  showVendorSelector = false;

  ngOnInit() {
    this.stateService.activeVendor$.subscribe(av => this.activeVendor = av);
  }

  toggleSelector() {
    this.showVendorSelector = !this.showVendorSelector;
  }

  logout() {
    this.showVendorSelector = false;
    this.authService.signOut().subscribe(() => {
      this.router.navigate(['/']);
    });
  }
}
