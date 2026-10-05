import { Injectable, inject, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BehaviorSubject, Observable, from, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { APP_CONFIG } from '../config/constants';

export interface AuthUser {
  id: string;
  usuario: string;
  nombre: string;
  rol: 'admin' | 'vendedor' | 'almacen';
  activo: boolean;
  email?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private supabase!: SupabaseClient;
  private isBrowser: boolean;

  private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private token: string | null = null;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this.supabase = createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false
        }
      });
      this.loadPersistedSession();
      this.initAuthListener();
    }
  }

  private initAuthListener() {
    this.supabase.auth.onAuthStateChange((event, session) => {
      if (session?.access_token) {
        this.token = session.access_token;
        if (typeof window !== 'undefined') {
          localStorage.setItem('concepcion_auth_token', session.access_token);
        }
      } else if (event === 'SIGNED_OUT') {
        this.token = null;
        this.currentUserSubject.next(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('concepcion_auth_token');
          localStorage.removeItem('concepcion_auth_user');
        }
      }
    });
  }

  private async loadPersistedSession() {
    if (typeof window === 'undefined') return;

    const savedUser = localStorage.getItem('concepcion_auth_user');
    const savedToken = localStorage.getItem('concepcion_auth_token');
    
    if (savedUser && savedToken) {
      this.token = savedToken;
      this.currentUserSubject.next(JSON.parse(savedUser));
    }

    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      if (session?.access_token) {
        this.token = session.access_token;
        localStorage.setItem('concepcion_auth_token', session.access_token);
      } else if (error) {
        console.warn('Sesión no sincronizada con Supabase:', error.message);
      }
    } catch (err) {
      console.warn('No se pudo verificar la sesión con Supabase:', err);
    }
  }

  public async refreshSession(): Promise<string | null> {
    if (!this.supabase) return null;
    try {
      const { data, error } = await this.supabase.auth.refreshSession();
      if (error || !data.session) {
        return null;
      }
      this.token = data.session.access_token;
      if (typeof window !== 'undefined') {
        localStorage.setItem('concepcion_auth_token', this.token);
      }
      return this.token;
    } catch {
      return null;
    }
  }

  public getCurrentToken(): string | null {
    return this.token;
  }

  public get isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  public get userRole(): 'admin' | 'vendedor' | 'almacen' | null {
    return this.currentUserSubject.value?.rol || null;
  }

  public get userId(): string | null {
    return this.currentUserSubject.value?.id || null;
  }

  public signIn(email: string, password: string): Observable<AuthUser> {
    // 1. Sign in to Supabase to obtain the access token
    const promise = this.supabase.auth.signInWithPassword({ email, password });
    
    return from(promise).pipe(
      switchMap(response => {
        if (response.error) {
          return throwError(() => new Error(response.error.message));
        }
        
        const session = response.data.session;
        if (!session) {
          return throwError(() => new Error('No se pudo establecer la sesión en Supabase'));
        }

        const tempToken = session.access_token;
        
        // 2. Fetch the user profile from our backend using this temporary token
        return this.http.get<AuthUser>(`${APP_CONFIG.apiUrl}/users/me`, {
          headers: { Authorization: `Bearer ${tempToken}` }
        }).pipe(
          map(dbUser => {
            // Save state
            this.token = tempToken;
            this.currentUserSubject.next(dbUser);
            
            if (typeof window !== 'undefined') {
              localStorage.setItem('concepcion_auth_token', tempToken);
              localStorage.setItem('concepcion_auth_user', JSON.stringify(dbUser));
            }
            
            return dbUser;
          })
        );
      }),
      catchError(err => {
        console.error('Error de autenticación:', err);
        return throwError(() => new Error(err.message || 'Error de inicio de sesión'));
      })
    );
  }

  public signOut(): Observable<void> {
    this.token = null;
    this.currentUserSubject.next(null);
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('concepcion_auth_token');
      localStorage.removeItem('concepcion_auth_user');
    }

    if (this.supabase) {
      this.supabase.auth.signOut().catch(err => {
        console.warn('Error calling Supabase signOut in background:', err);
      });
    }

    return from(Promise.resolve());
  }
}
