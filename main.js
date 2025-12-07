import axios from "axios";

/* ----------------- DOM ELEMENTS ----------------- */
const searchBtn = document.getElementById("searchBtn");
const cityInput = document.getElementById("cityInput");
const loader = document.getElementById("loader");

const searchResult = document.getElementById("searchResult");
const cityName = document.getElementById("cityName");
const condition = document.getElementById("condition");
const temperature = document.getElementById("temperature");
const searchDetails = document.getElementById("searchDetails");

const forecastRow = document.getElementById("forecast");
const hourlyStrip = document.getElementById("hourlyStrip");

const continentSelect = document.getElementById("continentSelect");
const countrySelect = document.getElementById("countrySelect");
const locCityInput = document.getElementById("locCityInput");
const locCityBtn = document.getElementById("locCityBtn");

const locationWeather = document.getElementById("locationWeather");
const locCityName = document.getElementById("locCityName");
const locCondition = document.getElementById("locCondition");
const locTemperature = document.getElementById("locTemperature");
const locDetails = document.getElementById("locDetails");

let hourlyChart = null;

/* ----------------- WEATHER CODE LOOKUP ----------------- */

function weatherDesc(code) {
  if (code === 0) return { label: "Clear sky", short: "Sunny" };
  if ([1, 2].includes(code)) return { label: "Mainly clear", short: "Cloudy" };
  if ([3].includes(code)) return { label: "Overcast", short: "Overcast" };
  if ([45, 48].includes(code)) return { label: "Fog", short: "Foggy" };
  if ([51, 53, 55].includes(code)) return { label: "Drizzle", short: "Drizzle" };
  if ([61, 63, 65, 80, 81, 82].includes(code)) return { label: "Rain", short: "Rain" };
  if ([71, 73, 75, 77].includes(code)) return { label: "Snow", short: "Snow" };
  if ([95, 96, 99].includes(code)) return { label: "Thunderstorm", short: "Storm" };
  return { label: "Unknown", short: "--" };
}

function iconKey(code) {
  if (code === 0) return "CLEAR_DAY";
  if ([1, 2].includes(code)) return "PARTLY_CLOUDY_DAY";
  if ([3, 45, 48].includes(code)) return "CLOUDY";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "RAIN";
  if ([71, 73, 75, 77].includes(code)) return "SNOW";
  if ([95, 96, 99].includes(code)) return "SLEET";
  return "CLOUDY";
}

function applyIcon(canvasId, code) {
  const id = iconKey(code);
  setTimeout(() => {
    const sky = new Skycons({ color: "#000" });
    sky.add(canvasId, Skycons[id]);
    sky.play();
  }, 50);
}

/* ----------------- WEATHER API ----------------- */

async function fetchWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&timezone=auto&current_weather=true` +
    `&hourly=temperature_2m,weathercode,windspeed_10m` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min`;

  return (await axios.get(url)).data;
}

/* ----------------- GEOCODING (Nominatim) ----------------- */

async function geocode(query) {
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=` +
    encodeURIComponent(query);

  const res = await axios.get(url, {
    headers: { "User-Agent": "Weather-Dashboard" }
  });

  if (!res.data || res.data.length === 0) return null;

  const p = res.data[0];

  return {
    name: p.display_name.split(",")[0],
    country: p.address.country || "",
    latitude: parseFloat(p.lat),
    longitude: parseFloat(p.lon)
  };
}

/* ----------------- UI Helpers ----------------- */

function chip(text) {
  const d = document.createElement("div");
  d.className = "chip";
  d.textContent = text;
  return d;
}

function fillDetails(container, data) {
  container.innerHTML = "";
  container.appendChild(chip(`Wind: ${data.current_weather.windspeed} km/h`));
}

/* ----------------- FORECAST ----------------- */

function showForecast(d) {
  forecastRow.innerHTML = "";

  for (let i = 0; i < d.time.length; i++) {
    const div = document.createElement("div");
    div.className = "forecast-day";

    const date = new Date(d.time[i]).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric"
    });

    const desc = weatherDesc(d.weathercode[i]);

    div.innerHTML = `
      <h4>${date}</h4>
      <div class="forecast-temp">${d.temperature_2m_max[i]}° / ${d.temperature_2m_min[i]}°</div>
      <div class="cond">${desc.short}</div>
    `;

    forecastRow.appendChild(div);
  }
}

/* ----------------- HOURLY STRIP ----------------- */

function showHourlyStrip(hourly, tz) {
  hourlyStrip.innerHTML = "";

  const now = Date.now();
  let count = 0;

  for (let i = 0; i < hourly.time.length && count < 24; i++) {
    const t = new Date(hourly.time[i]).getTime();
    if (t >= now) {
      const time = new Date(hourly.time[i]).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: tz
      });

      const temp = hourly.temperature_2m[i];
      const desc = weatherDesc(hourly.weathercode[i]);

      const card = document.createElement("div");
      card.className = "hour-card";

      card.innerHTML = `
        <div class="hour-time">${time}</div>
        <div class="hour-temp">${temp}°C</div>
        <div class="hour-cond">${desc.short}</div>
      `;

      hourlyStrip.appendChild(card);
      count++;
    }
  }
}

/* ----------------- HOURLY CHART ----------------- */

function showHourlyChart(hourly, tz) {
  const ctx = document.getElementById("hourlyChart").getContext("2d");

  const labels = [];
  const temps = [];
  const now = Date.now();

  for (let i = 0; i < hourly.time.length && temps.length < 24; i++) {
    const t = new Date(hourly.time[i]).getTime();
    if (t >= now) {
      labels.push(
        new Date(hourly.time[i]).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: tz
        })
      );
      temps.push(hourly.temperature_2m[i]);
    }
  }

  if (hourlyChart) hourlyChart.destroy();

  hourlyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          data: temps,
          borderColor: "#007aff",
          backgroundColor: "rgba(0,122,255,0.15)",
          tension: 0.4
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { maxTicksLimit: 8 } } }
    }
  });
}

/* ----------------- SEARCH WEATHER ----------------- */

searchBtn.onclick = async () => {
  const q = cityInput.value.trim();
  if (!q) return;

  loader.classList.remove("hidden");

  const geo = await geocode(q);
  if (!geo) {
    loader.classList.add("hidden");
    alert("No results found.");
    return;
  }

  const w = await fetchWeather(geo.latitude, geo.longitude);

  cityName.textContent = `${geo.name}, ${geo.country}`;
  temperature.textContent = `${w.current_weather.temperature}°C`;

  const desc = weatherDesc(w.current_weather.weathercode);
  condition.textContent = desc.label;

  applyIcon("iconCanvas", w.current_weather.weathercode);

  fillDetails(searchDetails, w);
  showForecast(w.daily);
  showHourlyChart(w.hourly, w.timezone);
  showHourlyStrip(w.hourly, w.timezone);

  searchResult.classList.remove("hidden");
  loader.classList.add("hidden");
};

/* ----------------- WORLD SELECTOR ----------------- */

const CONTINENTS = {
  Europe: [
    { code: "GB", name: "United Kingdom" },
    { code: "FR", name: "France" },
    { code: "DE", name: "Germany" },
    { code: "IT", name: "Italy" }
  ],
  Asia: [
    { code: "IN", name: "India" },
    { code: "JP", name: "Japan" },
    { code: "CN", name: "China" },
    { code: "SG", name: "Singapore" }
  ],
  Americas: [
    { code: "US", name: "United States" },
    { code: "CA", name: "Canada" }
  ]
};

Object.keys(CONTINENTS).forEach(cont => {
  const opt = document.createElement("option");
  opt.value = cont;
  opt.textContent = cont;
  continentSelect.appendChild(opt);
});

continentSelect.onchange = () => {
  countrySelect.innerHTML = `<option value="">Country</option>`;
  locCityInput.disabled = true;
  locCityBtn.disabled = true;

  if (!continentSelect.value) {
    countrySelect.disabled = true;
    return;
  }

  const list = CONTINENTS[continentSelect.value];
  countrySelect.disabled = false;

  list.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.code;
    opt.textContent = c.name;
    countrySelect.appendChild(opt);
  });
};

countrySelect.onchange = () => {
  locCityInput.disabled = !countrySelect.value;
  locCityBtn.disabled = !countrySelect.value;
};

/* ----------------- LOAD WORLD CITY ----------------- */

locCityBtn.onclick = async () => {
  const city = locCityInput.value.trim();
  const cc = countrySelect.value;

  if (!city || !cc) return;

  const geo = await geocode(`${city}, ${cc}`);
  if (!geo) return alert("City not found.");

  const w = await fetchWeather(geo.latitude, geo.longitude);

  locCityName.textContent = `${geo.name}, ${geo.country}`;
  locTemperature.textContent = `${w.current_weather.temperature}°C`;

  const desc = weatherDesc(w.current_weather.weathercode);
  locCondition.textContent = desc.label;

  applyIcon("locIconCanvas", w.current_weather.weathercode);
  fillDetails(locDetails, w);

  locationWeather.classList.remove("hidden");
};
