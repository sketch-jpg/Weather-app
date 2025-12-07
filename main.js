import axios from "axios";

/* === DOM ELEMENTS === */
const searchBtn = document.getElementById("searchBtn");
const cityInput = document.getElementById("cityInput");
const loader = document.getElementById("loader");

const searchResult = document.getElementById("searchResult");
const cityName = document.getElementById("cityName");
const temperature = document.getElementById("temperature");
const condition = document.getElementById("condition");
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

/* === WEATHER CODE → LABEL/ICON === */
function describe(code) {
  if (code === 0) return { label: "Clear sky", short: "Sunny" };
  if ([1, 2].includes(code)) return { label: "Mainly clear", short: "Partly cloudy" };
  if ([3].includes(code)) return { label: "Overcast", short: "Cloudy" };
  if ([45, 48].includes(code)) return { label: "Fog", short: "Foggy" };
  if ([51, 53, 55].includes(code)) return { label: "Drizzle", short: "Drizzle" };
  if ([61, 63, 65, 80, 81, 82].includes(code)) return { label: "Rain", short: "Rain" };
  if ([71, 73, 75, 77].includes(code)) return { label: "Snow", short: "Snow" };
  if ([95, 96, 99].includes(code)) return { label: "Thunderstorm", short: "Storm" };
  return { label: "Unknown", short: "--" };
}

function getIconKey(code) {
  if (code === 0) return "CLEAR_DAY";
  if ([1, 2].includes(code)) return "PARTLY_CLOUDY_DAY";
  if ([3, 45, 48].includes(code)) return "CLOUDY";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "RAIN";
  if ([71, 73, 75, 77].includes(code)) return "SNOW";
  if ([95, 96, 99].includes(code)) return "SLEET";
  return "CLOUDY";
}

function setIcon(canvasId, code) {
  const key = getIconKey(code);
  setTimeout(() => {
    const sky = new Skycons({ color: "white" });
    sky.add(canvasId, Skycons[key]);
    sky.play();
  }, 50);
}

/* === API === */
async function fetchWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&timezone=auto&current_weather=true` +
    `&hourly=temperature_2m,weathercode,windspeed_10m` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min`;

  return (await axios.get(url)).data;
}

async function geocode(name, country) {
  if (!name) return null;
  let url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=8`;

  if (country) url += `&countryCode=${country}`;

  const res = await axios.get(url);
  return res.data.results ? res.data.results[0] : null;
}

/* === UI Helpers === */

function chip(text) {
  const c = document.createElement("div");
  c.className = "chip";
  c.textContent = text;
  return c;
}

function fillDetails(container, weather) {
  container.innerHTML = "";
  container.appendChild(chip(`Wind: ${weather.current_weather.windspeed} km/h`));
}

function showForecast(d) {
  forecastRow.innerHTML = "";

  for (let i = 0; i < d.time.length; i++) {
    const div = document.createElement("div");
    div.className = "forecast-day";

    const date = new Date(d.time[i]).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric"
    });

    const info = describe(d.weathercode[i]);

    div.innerHTML = `
      <h4>${date}</h4>
      <div class="forecast-temp">${d.temperature_2m_max[i]}° / ${d.temperature_2m_min[i]}°</div>
      <div class="cond">${info.short}</div>
    `;
    forecastRow.appendChild(div);
  }
}

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
      const info = describe(hourly.weathercode[i]);

      const card = document.createElement("div");
      card.className = "hour-card";

      card.innerHTML = `
        <div class="hour-time">${time}</div>
        <div class="hour-temp">${temp}°C</div>
        <div class="hour-cond">${info.short}</div>
      `;

      hourlyStrip.appendChild(card);
      count++;
    }
  }
}

function showHourlyChart(hourly, tz) {
  const ctx = document.getElementById("hourlyChart").getContext("2d");

  const labels = [];
  const temps = [];
  const now = Date.now();

  for (let i = 0; i < hourly.time.length && temps.length < 24; i++) {
    const t = new Date(hourly.time[i]).getTime();
    if (t >= now) {
      const label = new Date(hourly.time[i]).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: tz
      });
      labels.push(label);
      temps.push(hourly.temperature_2m[i]);
    }
  }

  if (hourlyChart) hourlyChart.destroy();

  hourlyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: temps,
        borderColor: "#7aa7fa",
        backgroundColor: "rgba(122, 167, 250, 0.2)",
        tension: 0.4
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { maxTicksLimit: 8 } } }
    }
  });
}

/* === SEARCH WEATHER === */

searchBtn.addEventListener("click", async () => {
  const name = cityInput.value.trim();
  if (!name) return;

  loader.classList.remove("hidden");
  
  const geo = await geocode(name);
  if (!geo) return alert("City not found.");

  const w = await fetchWeather(geo.latitude, geo.longitude);

  cityName.textContent = `${geo.name}, ${geo.country}`;
  temperature.textContent = `${w.current_weather.temperature}°C`;

  const info = describe(w.current_weather.weathercode);
  condition.textCont
