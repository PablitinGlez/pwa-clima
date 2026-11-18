import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';

const PUSH_API_URL = 'https://servidor-push-bcah.onrender.com/api';
const VAPID_PUBLIC_KEY = 'BFyn6hQ9HdJ7QfmJc311RS-CjyFCmwyiMRCEyYNK4oZIZaEVQPsskTlHkYlIunAWIwYn41UEarwELtHpW0RoScs';

interface ServerHealth {
  status: string;
  subscriptions: number;
}

interface PushResult {
  enviadas: number;
  fallidas: number;
  suscripciones: number;
}

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly http = inject(HttpClient);
  private readonly swPush = inject(SwPush);

  readonly supported = this.swPush.isEnabled;
  readonly subscribed = signal(false);
  readonly busy = signal(false);
  readonly serverStatus = signal<'checking' | 'online' | 'offline'>('checking');
  readonly serverSubscriptions = signal<number | null>(null);
  readonly feedback = signal<string | null>(null);

  constructor() {
    void this.checkServer();
    void this.restoreSubscription();
  }

  async checkServer(): Promise<void> {
    this.serverStatus.set('checking');
    try {
      const health = await firstValueFrom(this.http.get<ServerHealth>(`${PUSH_API_URL}/health`));
      this.serverStatus.set(health.status === 'ok' ? 'online' : 'offline');
      this.serverSubscriptions.set(health.subscriptions);
    } catch {
      this.serverStatus.set('offline');
      this.serverSubscriptions.set(null);
    }
  }

  async subscribe(): Promise<void> {
    this.busy.set(true);
    this.feedback.set(null);
    try {
      const subscription = await this.swPush.requestSubscription({ serverPublicKey: VAPID_PUBLIC_KEY });
      await firstValueFrom(this.http.post(`${PUSH_API_URL}/subscribe`, subscription));
      this.subscribed.set(true);
      await this.checkServer();
      this.feedback.set('Suscripción exitosa: este dispositivo quedó registrado en el servidor push.');
    } catch (error) {
      this.subscribed.set(false);
      this.feedback.set(this.subscriptionError(error));
    } finally {
      this.busy.set(false);
    }
  }

  async sendNotification(title: string, body: string): Promise<void> {
    if (!this.subscribed()) {
      this.feedback.set('Primero activa las notificaciones en este dispositivo.');
      return;
    }

    this.busy.set(true);
    this.feedback.set(null);
    try {
      const result = await firstValueFrom(
        this.http.post<PushResult>(`${PUSH_API_URL}/push`, { title, body }),
      );
      this.feedback.set(
        `Servidor push: ${result.enviadas} enviada(s), ${result.fallidas} fallida(s), de ${result.suscripciones} suscripción(es).`,
      );
      await this.checkServer();
    } catch {
      this.feedback.set('No se pudo enviar el aviso. Revisa la conexión con el servidor push.');
    } finally {
      this.busy.set(false);
    }
  }

  private async restoreSubscription(): Promise<void> {
    if (!this.supported) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;

      await firstValueFrom(this.http.post(`${PUSH_API_URL}/subscribe`, subscription));
      this.subscribed.set(true);
      await this.checkServer();
    } catch {
      this.subscribed.set(false);
    }
  }

  private subscriptionError(error: unknown): string {
    if (error instanceof Error && error.name === 'NotAllowedError') {
      return 'El navegador bloqueó el permiso. Habilita las notificaciones para este sitio e inténtalo de nuevo.';
    }
    return 'No se pudo registrar la suscripción. Revisa el permiso del navegador y CORS del servidor.';
  }
}
