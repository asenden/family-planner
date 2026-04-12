interface CurrentWeather {
  temperature: number;
  weatherCode: number;
  icon: string;
  description: string;
}

interface DailyForecast {
  date: string;
  tempMin: number;
  tempMax: number;
  weatherCode: number;
  icon: string;
  description: string;
}

interface WeatherData {
  current: CurrentWeather;
  daily: DailyForecast[];
}

// WMO Weather interpretation codes → icon + description
const WEATHER_CODES: Record<number, { icon: string; en: string; de: string }> = {
  0: { icon: "☀️", en: "Clear sky", de: "Klarer Himmel" },
  1: { icon: "🌤️", en: "Mainly clear", de: "Überwiegend klar" },
  2: { icon: "⛅", en: "Partly cloudy", de: "Teilweise bewölkt" },
  3: { icon: "☁️", en: "Overcast", de: "Bedeckt" },
  45: { icon: "🌫️", en: "Fog", de: "Nebel" },
  48: { icon: "🌫️", en: "Rime fog", de: "Reifnebel" },
  51: { icon: "🌦️", en: "Light drizzle", de: "Leichter Nieselregen" },
  53: { icon: "🌦️", en: "Drizzle", de: "Nieselregen" },
  55: { icon: "🌦️", en: "Dense drizzle", de: "Starker Nieselregen" },
  61: { icon: "🌧️", en: "Light rain", de: "Leichter Regen" },
  63: { icon: "🌧️", en: "Rain", de: "Regen" },
  65: { icon: "🌧️", en: "Heavy rain", de: "Starker Regen" },
  71: { icon: "🌨️", en: "Light snow", de: "Leichter Schneefall" },
  73: { icon: "🌨️", en: "Snow", de: "Schneefall" },
  75: { icon: "❄️", en: "Heavy snow", de: "Starker Schneefall" },
  80: { icon: "🌧️", en: "Rain showers", de: "Regenschauer" },
  81: { icon: "🌧️", en: "Rain showers", de: "Regenschauer" },
  82: { icon: "⛈️", en: "Heavy showers", de: "Starke Regenschauer" },
  85: { icon: "🌨️", en: "Snow showers", de: "Schneeschauer" },
  86: { icon: "❄️", en: "Heavy snow showers", de: "Starke Schneeschauer" },
  95: { icon: "⛈️", en: "Thunderstorm", de: "Gewitter" },
  96: { icon: "⛈️", en: "Thunderstorm with hail", de: "Gewitter mit Hagel" },
  99: { icon: "⛈️", en: "Thunderstorm with heavy hail", de: "Gewitter mit starkem Hagel" },
};

function getWeatherInfo(code: number, locale: string): { icon: string; description: string } {
  const info = WEATHER_CODES[code] || WEATHER_CODES[0];
  return { icon: info.icon, description: locale === "de" ? info.de : info.en };
}

export async function fetchWeather(lat: number, lon: number, locale: string): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=7`;

  const res = await fetch(url, { next: { revalidate: 600 } }); // cache 10 minutes
  const data = await res.json();

  const currentInfo = getWeatherInfo(data.current.weather_code, locale);

  return {
    current: {
      temperature: Math.round(data.current.temperature_2m),
      weatherCode: data.current.weather_code,
      icon: currentInfo.icon,
      description: currentInfo.description,
    },
    daily: data.daily.time.map((date: string, i: number) => {
      const info = getWeatherInfo(data.daily.weather_code[i], locale);
      return {
        date,
        tempMin: Math.round(data.daily.temperature_2m_min[i]),
        tempMax: Math.round(data.daily.temperature_2m_max[i]),
        weatherCode: data.daily.weather_code[i],
        icon: info.icon,
        description: info.description,
      };
    }),
  };
}

export type { WeatherData, CurrentWeather, DailyForecast };
