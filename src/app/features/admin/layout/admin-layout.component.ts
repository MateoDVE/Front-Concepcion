import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { StateService } from '../../../core/services/state.service';
import { AuthService } from '../../../core/services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
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

  resetData() {
    if (confirm('¿Estás seguro de que deseas reiniciar los datos predeterminados?')) {
      this.stateService.resetData();
      alert('Datos reiniciados.');
      this.router.navigate(['/admin/dashboard']);
    }
  }

  clearLocalData() {
    if (confirm('¿Deseas limpiar todos los datos guardados en LocalStorage?')) {
      this.stateService.clearLocalData();
      alert('Datos de LocalStorage limpiados.');
      this.router.navigate(['/admin/dashboard']);
    }
  }

  logout() {
    this.authService.signOut().subscribe(() => {
      this.router.navigate(['/']);
    });
  }
}
