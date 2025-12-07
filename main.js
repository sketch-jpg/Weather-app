import axios from "axios";

// DOM references
const searchBtn = document.getElementById("searchBtn");
const cityInput = document.getElementById("cityInput");
const loader = document.getElementById("loader");

const localLocationLabel = document.getElementById("localLocationLabel");
const localTemp = document.getElementById("localTemp");
const localCond = document.getElementById("localCond");
const localDetails = document.getElementById("localDetails");

const searchResult = document.getElementById("searchResult");
const cityName = document.getElementById("cityName");
const temperature = document.getElementById("temperature");
const condition = document.getElementById("condition");
const searchDetails = document.getElementById("searchDetails");

const forecastRow = document.getElementById("forecast");

const continentSelect = document.getElementById("continentSelect");
const countrySelect = document.getElementById("countrySelect");
const locCityInput = document.getElementById("locCityInput");
const locCityBtn = document.getElementById("locCityBtn");

const locationWeather = document.getElementById("locationWeather");
const locCityName = document.getElementById("locCityName");
const locCondition = document.getElementById("locCondition");
const locTemperature = document.getElementById("locTemperature");
const locDetails = document.getElementById("locDetails");

const hourlyStrip = document.getElementById("hourlyStrip");

let hourlyChart = null;

// --- Weather code → label & icon key

function describeWeather(code) {
  if (code === 0) return { label: "Clear sky", short: "Sunny" };
  if ([1, 2].includes(code)) return { label: "Mainly clear", short: "Partly cloudy" };
  if ([3].includes(code)) return { label: "Overcast", short: "Cloudy" };
  if ([45, 48].includes(code)) return { label: "Foggy", short: "Fog" };
  if ([51, 53, 55, 56, 57].includes(code))
    return { label: "Drizzle", short: "Drizzle" };
  if ([61, 63, 65, 80, 81, 82].includes(code))
    return { label: "Rainy", short: "Rain" };
  if ([71, 73, 75, 77].includes(code))
    return { label: "Snowy", short: "Snow" };
  if ([95, 96, 97, 98, 99].includes(code))
    return { label: "Stormy", short: "Storm" };
  return { label: "Unknown", short: "—" };
}

function getIconKey(code) {
  if (code === 0) return "CLEAR_DAY";
  if ([1, 2].includes(code)) return "PARTLY_CLOUDY_DAY";
  if ([3, 45, 48].includes(code)) return "CLOUDY";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "RAIN";
  if ([71, 73, 75, 77].includes(code)) return "SNOW";
  if ([95, 96, 97, 98, 99].includes(code)) return "SLEET";
  return "CLOUDY";
}

function setIcon(canvasId, code) {
  const iconKey = getIconKey(code);
  setTimeout(() => {
    const skycons = new Skycons({ color: "white" });
    skycons.add(canvasId, Skycons[iconKey]);
    skycons.play();
  }, 50);
}

// --- Open-Meteo API wrappers

async function fetchWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current_weather=true&timezone=auto&hourly=temperature_2m,relativehumidity_2m,weathercode,windspeed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset,uv_index_max`;

  const res = await axios.get(url);
  return res.data;
}

async function geocodeCity(name, countryCode) {
  if (!name || name.length < 2) return null;

  let url =
    "https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(name) + "&count=10&language=en";

  if (countryCode) {
    url += `&countryCode=${countryCode}`;
  }

  const res = await axios.get(url);
  const { results } = res.data || {};
  if (!results || results.length === 0) return null;
  return results[0];
}

// --- UI helpers

function createChip(text) {
  const span = document.createElement("span");
  span.className = "chip";
  span.textContent = text;
  return span;
}

function populateDetails(container, weather) {
  container.innerHTML = "";

  const { current_weather, daily, hourly } = weather;

  const humidity = hourly?.relativehumidity_2m?.[0];
  if (humidity != null) {
    container.appendChild(createChip(`Humidity: ${humidity}%`));
  }

  container.appendChild(createChip(`Wind: ${current_weather.windspeed} km/h`));

  const uv = daily.uv_index_max?.[0];
  if (uv != null) {
    container.appendChild(createChip(`UV max: ${uv}`));
  }

  const sunrise = daily.sunrise?.[0];
  const sunset = daily.sunset?.[0];
  if (sunrise && sunset) {
    const sRise = new Date(sunrise).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    const sSet = new Date(sunset).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    container.appendChild(createChip(`Sunrise: ${sRise}`));
    container.appendChild(createChip(`Sunset: ${sSet}`));
  }
}

function renderForecast(daily) {
  forecastRow.innerHTML = "";
  if (!daily || !daily.time) return;

  const len = daily.time.length;
  for (let i = 0; i < len; i++) {
    const card = document.createElement("div");
    card.className = "forecast-day";

    const date = new Date(daily.time[i]);
    const label = date.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
    });
    const desc = describeWeather(daily.weathercode[i]);

    card.innerHTML = `
      <h4>${label}</h4>
      <div class="forecast-temp">${daily.temperature_2m_max[i]}° / ${daily.temperature_2m_min[i]}°</div>
      <div class="forecast-code">${desc.short}</div>
    `;

    forecastRow.appendChild(card);
  }
}

function renderHourlyChart(hourly, timezone) {
  const ctx = document.getElementById("hourlyChart").getContext("2d");
  const labels = [];
  const temps = [];
  const now = Date.now();

  for (let i = 0; i < hourly.time.length && temps.length < 24; i++) {
    const t = new Date(hourly.time[i]).getTime();
    if (t >= now) {
      const timeLabel = new Date(hourly.time[i]).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      });
      labels.push(timeLabel);
      temps.push(hourly.temperature_2m[i]);
    }
  }

  if (hourlyChart) {
    hourlyChart.destroy();
  }

  hourlyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Temp (°C)",
          data: temps,
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxTicksLimit: 8 } }
      }
    }
  });
}

function renderHourlyStrip(hourly, timezone) {
  hourlyStrip.innerHTML = "";
  if (!hourly || !hourly.time) return;

  const now = Date.now();
  let count = 0;

  for (let i = 0; i < hourly.time.length && count < 24; i++) {
    const t = new Date(hourly.time[i]).getTime();
    if (t >= now) {
      const timeLabel = new Date(hourly.time[i]).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      });
      const temp = hourly.temperature_2m[i];
      const code = hourly.weathercode[i];
      const wind = hourly.windspeed_10m[i];
      const desc = describeWeather(code);

      const card = document.createElement("div");
      card.className = "hour-card";
      card.innerHTML = `
        <div class="hour-time">${timeLabel}</div>
        <div class="hour-temp">${temp}°C</div>
        <div class="hour-cond">${desc.short}</div>
        <div class="hour-wind">${wind} km/h</div>
      `;
      hourlyStrip.appendChild(card);
      count++;
    }
  }
}

function showLoader(show) {
  if (show) loader.classList.remove("hidden");
  else loader.classList.add("hidden");
}

// --- Load local weather on start

async function loadLocalWeather() {
  localLocationLabel.textContent = "Detecting...";

  // GPS timeout after 2 seconds
  const geoPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject("timeout"), 2000);

    navigator.geolocation.getCurrentPosition(
      pos => {
        clearTimeout(timer);
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          method: "gps"
        });
      },
      err => {
        clearTimeout(timer);
        reject("gps_error");
      }
    );
  });

  let location;

  try {
    // Try quick GPS
    location = await geoPromise;
    console.log("Using GPS location");
  } catch (e) {
    console.log("GPS failed or slow, using IP geolocation");

    // Fallback to IP lookup (instant)
    const ipRes = await axios.get("https://ip-api.open-meteo.com/v1/ip");
    location = {
      lat: ipRes.data.latitude,
      lon: ipRes.data.longitude,
      city: ipRes.data.city,
      country: ipRes.data.country,
      method: "ip"
    };
  }

  try {
    const weather = await fetchWeather(location.lat, location.lon);

    if (location.method === "gps") {
      localLocationLabel.textContent = `GPS (${location.lat.toFixed(2)}, ${location.lon.toFixed(2)})`;
    } else {
      localLocationLabel.textContent = `${location.city}, ${location.country}`;
    }

    localTemp.textContent = `${weather.current_weather.temperature}°C`;

    const desc = describeWeather(weather.current_weather.weathercode);
    localCond.textContent = `${desc.label} • Wind ${weather.current_weather.windspeed} km/h`;

    setIcon("localIcon", weather.current_weather.weathercode);
    populateDetails(localDetails, weather);
    renderForecast(weather.daily);
    renderHourlyChart(weather.hourly, weather.timezone);
    renderHourlyStrip(weather.hourly, weather.timezone);

  } catch (err) {
    localCond.textContent = "Error loading weather";
  }
}

// --- Search city weather

searchBtn.addEventListener("click", async () => {
  const query = cityInput.value.trim();
  if (!query) {
    alert("Please enter a city name.");
    return;
  }

  try {
    showLoader(true);
    const geo = await geocodeCity(query);
    if (!geo) {
      alert("City not found.");
      showLoader(false);
      return;
    }

    const weather = await fetchWeather(geo.latitude, geo.longitude);

    cityName.textContent = `${geo.name}, ${geo.country}`;
    temperature.textContent = `${weather.current_weather.temperature}°C`;

    const desc = describeWeather(weather.current_weather.weathercode);
    condition.textContent = `${desc.label} • Wind ${weather.current_weather.windspeed} km/h`;

    setIcon("iconCanvas", weather.current_weather.weathercode);
    populateDetails(searchDetails, weather);

    searchResult.classList.remove("hidden");

    renderForecast(weather.daily);
    renderHourlyChart(weather.hourly, weather.timezone);
    renderHourlyStrip(weather.hourly, weather.timezone);
  } catch (err) {
    alert("Error fetching weather data.");
  } finally {
    showLoader(false);
  }
});

// --- Continent → Country selector (partial list; extendable)

const CONTINENT_COUNTRIES = {
  Europe: [
    { code: "GB", name: "United Kingdom" },
    { code: "FR", name: "France" },
    { code: "DE", name: "Germany" },
    { code: "IT", name: "Italy" },
    { code: "ES", name: "Spain" }
  ],
  Asia: [
    { code: "IN", name: "India" },
    { code: "JP", name: "Japan" },
    { code: "CN", name: "China" },
    { code: "SG", name: "Singapore" },
    { code: "AU", name: "Australia" }
  ],
  Americas: [
    { code: "US", name: "United States" },
    { code: "CA", name: "Canada" },
    { code: "BR", name: "Brazil" }
  ],
  Africa: [
    { code: "ZA", name: "South Africa" },
    { code: "EG", name: "Egypt" },
    { code: "NG", name: "Nigeria" }
  ]
};

function initLocationSelectors() {
  Object.keys(CONTINENT_COUNTRIES).forEach((cont) => {
    const opt = document.createElement("option");
    opt.value = cont;
    opt.textContent = cont;
    continentSelect.appendChild(opt);
  });

  continentSelect.addEventListener("change", () => {
    const cont = continentSelect.value;
    countrySelect.innerHTML = `<option value="">Country</option>`;
    locCityInput.value = "";
    locCityInput.disabled = true;
    locCityBtn.disabled = true;
    locationWeather.classList.add("hidden");

    if (!cont) {
      countrySelect.disabled = true;
      return;
    }

    CONTINENT_COUNTRIES[cont].forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.code;
      opt.textContent = c.name;
      countrySelect.appendChild(opt);
    });

    countrySelect.disabled = false;
  });

  countrySelect.addEventListener("change", () => {
    const code = countrySelect.value;
    locCityInput.value = "";
    locationWeather.classList.add("hidden");

    if (!code) {
      locCityInput.disabled = true;
      locCityBtn.disabled = true;
    } else {
      locCityInput.disabled = false;
      locCityBtn.disabled = false;
    }
  });

  locCityBtn.addEventListener("click", async () => {
    const code = countrySelect.value;
    const name = locCityInput.value.trim();
    if (!code || !name) {
      alert("Select country and enter city name.");
      return;
    }
    try {
      const geo = await geocodeCity(name, code);
      if (!geo) {
        alert("No matching city found.");
        return;
      }
      const weather = await fetchWeather(geo.latitude, geo.longitude);

      locCityName.textContent = `${geo.name}, ${geo.country}`;
      const desc = describeWeather(weather.current_weather.weathercode);
      locCondition.textContent = `${desc.label} • Wind ${weather.current_weather.windspeed} km/h`;
      locTemperature.textContent = `${weather.current_weather.temperature}°C`;

      setIcon("locIconCanvas", weather.current_weather.weathercode);
      populateDetails(locDetails, weather);

      locationWeather.classList.remove("hidden");
    } catch (err) {
      alert("Error fetching location weather.");
    }
  });
}

initLocationSelectors();
loadLocalWeather();
