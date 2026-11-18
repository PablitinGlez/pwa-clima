import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { PushNotificationService } from './push-notification.service';
import { City, WeatherForecast, WeatherService } from './weather.service';

@Component({
  imports: [DatePipe, DecimalPipe, FormsModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly weatherService = inject(WeatherService);
  protected readonly push = inject(PushNotificationService);

  protected readonly quickCities = [
    { label: 'Ciudad de México', query: 'Ciudad de México' },
    { label: 'Guadalajara', query: 'Guadalajara, Jalisco, México' },
    { label: 'Monterrey', query: 'Monterrey, Nuevo León, México' },
    { label: 'Puebla', query: 'Puebla, Puebla, México' },
    { label: 'Mérida', query: 'Mérida, Yucatán, México' },
  ];

  protected cityQuery = 'Ciudad de México';
  protected readonly selectedCity = signal<City | null>(null);
  protected readonly forecast = signal<WeatherForecast | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly updatedAt = signal<Date | null>(null);

  constructor() {
    void this.searchWeather();
  }

  protected selectQuickCity(query: string): void {
    this.cityQuery = query;
    void this.searchWeather();
  }

  protected async searchWeather(): Promise<void> {
    const query = this.cityQuery.trim();
    if (query.length < 2) {
      this.errorMessage.set('Escribe al menos dos letras para buscar una ciudad.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.forecast.set(null);
    this.selectedCity.set(null);
    this.updatedAt.set(null);

    try {
      const response = await firstValueFrom(this.weatherService.searchCities(query));
      const city = response.results?.[0];
      if (!city) {
        this.forecast.set(null);
        this.selectedCity.set(null);
        this.errorMessage.set(`No encontré una ciudad con el nombre “${query}”. Prueba con otro nombre.`);
        return;
      }

      const weather = await firstValueFrom(this.weatherService.getForecast(city));
      this.selectedCity.set(city);
      this.forecast.set(weather);
      this.updatedAt.set(new Date());
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  protected weatherDescription(code: number): string {
    if (code === 0) return 'Despejado';
    if (code === 1) return 'Mayormente despejado';
    if (code === 2) return 'Parcialmente nublado';
    if (code === 3) return 'Nublado';
    if (code === 45 || code === 48) return 'Neblina';
    if (code >= 51 && code <= 67) return 'Llovizna o lluvia';
    if (code >= 71 && code <= 77) return 'Nieve';
    if (code >= 80 && code <= 82) return 'Chubascos';
    if (code === 85 || code === 86) return 'Chubascos de nieve';
    if (code >= 95) return 'Tormenta';
    return 'Condición variable';
  }

  protected weatherIcon(code: number): string {
    if (code === 0) return '☀️';
    if (code <= 2) return '🌤️';
    if (code === 3) return '☁️';
    if (code === 45 || code === 48) return '🌫️';
    if (code >= 51 && code <= 67) return '🌧️';
    if (code >= 71 && code <= 77) return '❄️';
    if (code >= 80 && code <= 82) return '🌦️';
    if (code === 85 || code === 86) return '🌨️';
    if (code >= 95) return '⛈️';
    return '🌡️';
  }

  protected formatForecastDay(date: string): string {
    return new Intl.DateTimeFormat('es-MX', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
  }

  protected async notifyForecast(): Promise<void> {
    const city = this.selectedCity();
    const weather = this.forecast();
    if (!city || !weather) return;

    const rainDay = weather.daily.precipitation_probability_max.findIndex((probability) => probability >= 50);
    if (rainDay >= 0) {
      const probability = weather.daily.precipitation_probability_max[rainDay];
      await this.push.sendNotification(
        `Posible lluvia en ${city.name}`,
        `${this.formatForecastDay(weather.daily.time[rainDay])}: probabilidad de lluvia del ${probability}%. Consulta Clima escolar para revisar el pronóstico.`,
      );
      return;
    }

    await this.push.sendNotification(
      `Pronóstico de ${city.name}`,
      `${this.weatherDescription(weather.current.weather_code)} y ${weather.current.temperature_2m} °C actualmente. No se pronostica lluvia con probabilidad de 50% o más en los próximos días.`,
    );
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'No pude conectar con Open-Meteo. Revisa tu conexión e inténtalo de nuevo.';
    }
    return 'No se pudo cargar el pronóstico. Inténtalo de nuevo en un momento.';
  }
}
