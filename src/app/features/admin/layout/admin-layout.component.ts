import { DataStatusComponent } from '../../../core/components/data-status/data-status.component';
import { NavigationDrawerDirective } from '../../../shared/directives/navigation-drawer.directive';
import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { StateService } from '../../../core/services/state.service';
import { AuthService } from '../../../core/services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-layout',
  imports: [DataStatusComponent, RouterOutlet, RouterLink, RouterLinkActive, CommonModule, NavigationDrawerDirective],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
  standalone: true
})
export class AdminLayoutComponent {
  private stateService = inject(StateService);
  private router = inject(Router);
  private authService = inject(AuthService);

  isMobileSidebarOpen = false;

  toggleMobileSidebar() {
    this.isMobileSidebarOpen = !this.isMobileSidebarOpen;
  }

  closeMobileSidebar() {
    this.isMobileSidebarOpen = false;
  }

  logout() {
    this.authService.signOut().subscribe(() => {
      this.router.navigate(['/']);
    });
  }
}
