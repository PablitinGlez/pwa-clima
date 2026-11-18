import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface City {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
  timezone: string;
}

interface GeocodingResponse {
  results?: City[];
}

export interface CurrentWeather {
  time: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  precipitation: number;
  weather_code: number;
  wind_speed_10m: number;
}

export interface DailyForecast {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
}

export interface WeatherForecast {
  current: CurrentWeather;
  daily: DailyForecast;
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private readonly http = inject(HttpClient);
  private readonly geocodingUrl = 'https://geocoding-api.open-meteo.com/v1/search';
  private readonly forecastUrl = 'https://api.open-meteo.com/v1/forecast';

  searchCities(name: string): Observable<GeocodingResponse> {
    const params = new HttpParams({
      fromObject: {
        name,
        count: '5',
        language: 'es',
        format: 'json',
      },
    });

    return this.http.get<GeocodingResponse>(this.geocodingUrl, { params });
  }

  getForecast(city: City): Observable<WeatherForecast> {
    const params = new HttpParams({
      fromObject: {
        latitude: String(city.latitude),
        longitude: String(city.longitude),
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
        forecast_days: '5',
        timezone: 'auto',
      },
    });

    return this.http.get<WeatherForecast>(this.forecastUrl, { params });
  }
}
