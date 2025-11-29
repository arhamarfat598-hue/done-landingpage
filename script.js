// ======================
// CONFIG – AeroDataBox (RapidAPI)
// ======================

const RAPIDAPI_HOST = "aerodatabox.p.rapidapi.com";

// 👉 Yahan apni REAL RapidAPI key daalo:
const RAPIDAPI_KEY = "05120d0619mshbf8a5b27be89422p1f835bjsn00ec12905763";

// simple INR → USD conversion (approx)
const INR_TO_USD = 86;

// DOM elements
const form = document.getElementById("searchForm");
const statusEl = document.getElementById("searchStatus");
const resultsEl = document.getElementById("apiResults");

const fromInput = document.getElementById("from");
const toInput = document.getElementById("to");
const dateInput = document.getElementById("date");
const returnDateInput = document.getElementById("returnDate");
const passengersInput = document.getElementById("passengers");

const tabs = document.querySelectorAll(".tab");
let currentTripType = "oneway"; // oneway | round | multi

// ======================
// INIT: default date = today
// ======================
(function setToday() {
  const today = new Date().toISOString().split("T")[0];
  dateInput.value = today;
})();

// ======================
// UI helpers
// ======================
function setStatus(type, text) {
  if (!text) {
    statusEl.innerHTML = "";
    return;
  }

  const cls =
    type === "error" ? "error" : type === "success" ? "success" : "";

  statusEl.innerHTML = `
    <div class="pill ${cls}">
      <span class="dot"></span>
      <span>${text}</span>
    </div>
  `;
}

async function aeroFetch(path, params = null) {
  let url = `https://${RAPIDAPI_HOST}${path}`;
  if (params) {
    const qs = new URLSearchParams(params);
    url += `?${qs.toString()}`;
  }

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": RAPIDAPI_HOST
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} – ${text}`);
  }
  return res.json();
}

// ======================
// Airport search
// GET /airports/search/term?q=&limit=5
// ======================
async function findAirport(term) {
  const data = await aeroFetch("/airports/search/term", {
    q: term,
    limit: 5
  });

  const items = Array.isArray(data) ? data : data.items;
  if (!items || items.length === 0) return null;

  const a = items.find((x) => x.iata && x.iata.length > 0) || items[0];

  return {
    name: a.name || a.shortName || "",
    iata: a.iata || "",
    icao: a.icao || "",
    city: a.municipalityName || a.city || "",
    country: a.countryCode || ""
  };
}

// ======================
// Distance & time
// GET /airports/iata/{from}/distance-time/{to}
// ======================
async function getDistanceTime(fromIata, toIata) {
  return aeroFetch(
    `/airports/iata/${encodeURIComponent(
      fromIata
    )}/distance-time/${encodeURIComponent(toIata)}`,
    {
      // ye params optional hai, but safe:
      withDistance: "true",
      withFlightTime: "true"
    }
  );
}

// ======================
// Helper: distance (km) & duration string extract
// ======================
function extractKm(distanceObj) {
  if (!distanceObj) return null;

  // hamara purana fallback
  if (typeof distanceObj.distanceKm === "number") {
    return distanceObj.distanceKm;
  }

  // AeroDataBox official: greatCircleDistance.km
  if (
    distanceObj.greatCircleDistance &&
    typeof distanceObj.greatCircleDistance.km === "number"
  ) {
    return distanceObj.greatCircleDistance.km;
  }

  return null;
}

function extractDuration(distanceObj) {
  if (!distanceObj) return null;

  if (typeof distanceObj.flightTime === "string") {
    return distanceObj.flightTime;
  }

  if (
    distanceObj.flightTimes &&
    typeof distanceObj.flightTimes.total === "string"
  ) {
    return distanceObj.flightTimes.total;
  }

  if (typeof distanceObj.flightTimeMinutes === "number") {
    const mins = distanceObj.flightTimeMinutes;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  }

  return null;
}

// ======================
// Render result card
// ======================
function renderResultCard({
  from,
  to,
  date,
  returnDate,
  passengers,
  tripType,
  distance
}) {
  let distanceText = "N/A";
  let timeText = "N/A";
  let usdText = "$--";
  let inrText = "₹--";

  const km = extractKm(distance);
  if (typeof km === "number" && !Number.isNaN(km)) {
    distanceText = `${km.toLocaleString("en-US")} km`;

    const baseINR = Math.max(1000, Math.round(km * 5)); // base sample fare
    inrText = `₹${baseINR.toLocaleString("en-IN")}`;

    const usd = baseINR / INR_TO_USD;
    usdText = `$${usd.toFixed(2)} USD`;
  }

  const durationStr = extractDuration(distance);
  if (durationStr) {
    timeText = durationStr;
  }

  const tripLabel =
    tripType === "round"
      ? "Round Trip"
      : tripType === "multi"
      ? "Multi-City"
      : "One Way";

  const html = `
    <article class="result-card">
      <div class="result-route">
        ${from.city || from.name || from.iata} → ${
    to.city || to.name || to.iata
  }
        <span class="result-codes">(${from.iata || from.icao} → ${
    to.iata || to.icao
  })</span>
      </div>
      <div class="result-sub">
        ${tripLabel} • ${from.name || from.iata} → ${to.name || to.iata}
      </div>

      <div class="result-main-row">
        <div>
          <div class="result-label">Estimated one-way fare</div>
          <div class="result-price">${usdText}</div>
          <div class="result-price-sub">(approx. ${inrText})</div>
        </div>
      </div>

      <div class="result-meta">
        <div><strong>Distance:</strong> ${distanceText}</div>
        <div><strong>Duration:</strong> ${timeText}</div>
        <div><strong>Departure:</strong> ${date || "-"}</div>
        <div><strong>Return:</strong> ${returnDate || "-"}</div>
        <div><strong>Passengers:</strong> ${passengers}</div>
        <div><strong>Trip type:</strong> ${tripLabel}</div>
      </div>
    </article>
  `;

  resultsEl.innerHTML = html;
}

// ======================
// Tabs logic
// ======================
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentTripType = tab.getAttribute("data-trip") || "oneway";
  });
});

// ======================
// Form submit
// ======================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fromText = fromInput.value.trim();
  const toText = toInput.value.trim();
  const date = dateInput.value;
  const returnDate = returnDateInput.value;
  const passengers = passengersInput.value;

  if (!fromText || !toText || !date) {
    alert("Please fill From, To and Departure date.");
    return;
  }

  resultsEl.innerHTML = "";
  setStatus("loading", "Searching airports & fetching distance and duration...");

  try {
    const [fromAirport, toAirport] = await Promise.all([
      findAirport(fromText),
      findAirport(toText)
    ]);

    if (!fromAirport || !toAirport) {
      setStatus(
        "error",
        "Airport not found. Try city + code, e.g. 'Delhi DEL', 'Dubai DXB'."
      );
      return;
    }

    if (!fromAirport.iata || !toAirport.iata) {
      setStatus(
        "error",
        "One airport has no IATA code. Try another city/airport."
      );
      return;
    }

    const distance = await getDistanceTime(fromAirport.iata, toAirport.iata);

    renderResultCard({
      from: fromAirport,
      to: toAirport,
      date,
      returnDate,
      passengers,
      tripType: currentTripType,
      distance
    });

    setStatus("success", "Result loaded successfully.");

    // save last search
    try {
      localStorage.setItem(
        "easyfly_last_search",
        JSON.stringify({
          from: fromText,
          to: toText,
          date,
          returnDate,
          passengers,
          tripType: currentTripType
        })
      );
    } catch (_) {}

    document
      .getElementById("results")
      .scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    console.error(err);
    setStatus(
      "error",
      "API error: " +
        (err && err.message
          ? err.message
          : "Please check RapidAPI key / network.")
    );
  }
});

// ======================
// Prefill last search
// ======================
(function prefillLastSearch() {
  try {
    const raw = localStorage.getItem("easyfly_last_search");
    if (!raw) return;
    const data = JSON.parse(raw);

    if (data.from) fromInput.value = data.from;
    if (data.to) toInput.value = data.to;
    if (data.date) dateInput.value = data.date;
    if (data.returnDate) returnDateInput.value = data.returnDate;
    if (data.passengers) passengersInput.value = data.passengers;

    if (data.tripType) {
      currentTripType = data.tripType;
      tabs.forEach((tab) => {
        tab.classList.toggle(
          "active",
          tab.getAttribute("data-trip") === currentTripType
        );
      });
    }
  } catch (_) {}
})();
