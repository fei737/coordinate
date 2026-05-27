const COORD_PRECISION = 6;
const PI = Math.PI;
const X_PI = (PI * 3000.0) / 180.0;
const A = 6378245.0;
const EE = 0.00669342162296594323;

const state = {
    activeType: "bd09",
    coords: {
        wgs84: { lng: 121.4737, lat: 31.2304 },
        gcj02: { lng: 121.478223, lat: 31.228458 },
        bd09: { lng: 121.484782, lat: 31.234311 }
    }
};

let mapInstance = null;
let mapMarker = null;

const statusEl = document.getElementById("map-status");
const locateBtn = document.getElementById("locate-btn");
const coordSystemEl = document.getElementById("coord-system");
const currentLngEl = document.getElementById("current-lng");
const currentLatEl = document.getElementById("current-lat");
const coordSheetEl = document.getElementById("coord-sheet");
const sheetToggleEl = document.getElementById("sheet-toggle");

function setStatus(message, type = "warning") {
    statusEl.textContent = message;
    statusEl.className = `map-status ${type}`;
}

function formatCoord(value) {
    return Number(value).toFixed(COORD_PRECISION);
}

function outOfChina(lng, lat) {
    return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(lng, lat) {
    let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
    ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(lat * PI) + 40.0 * Math.sin(lat / 3.0 * PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(lat / 12.0 * PI) + 320 * Math.sin(lat * PI / 30.0)) * 2.0 / 3.0;
    return ret;
}

function transformLng(lng, lat) {
    let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
    ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(lng * PI) + 40.0 * Math.sin(lng / 3.0 * PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(lng / 12.0 * PI) + 300.0 * Math.sin(lng / 30.0 * PI)) * 2.0 / 3.0;
    return ret;
}

function wgs84ToGcj02(lng, lat) {
    if (outOfChina(lng, lat)) {
        return { lng, lat };
    }

    let dLat = transformLat(lng - 105.0, lat - 35.0);
    let dLng = transformLng(lng - 105.0, lat - 35.0);
    const radLat = lat / 180.0 * PI;
    let magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);

    return {
        lng: lng + dLng,
        lat: lat + dLat
    };
}

function gcj02ToBd09(lng, lat) {
    const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * X_PI);
    const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * X_PI);
    return {
        lng: z * Math.cos(theta) + 0.0065,
        lat: z * Math.sin(theta) + 0.006
    };
}

function convertFromWgs84(lng, lat) {
    const wgs84 = { lng, lat };
    const gcj02 = wgs84ToGcj02(lng, lat);
    const bd09 = gcj02ToBd09(gcj02.lng, gcj02.lat);
    return { wgs84, gcj02, bd09 };
}

function getActiveCoords() {
    return state.coords[state.activeType];
}

function renderActiveCoords() {
    const active = getActiveCoords();
    currentLngEl.textContent = formatCoord(active.lng);
    currentLatEl.textContent = formatCoord(active.lat);
}

function updateFromWgs84(lng, lat, sourceLabel) {
    state.coords = convertFromWgs84(lng, lat);
    renderActiveCoords();

    if (mapMarker) {
        mapMarker.setLatLng([state.coords.wgs84.lat, state.coords.wgs84.lng]);
    }

    if (mapInstance) {
        mapInstance.setView([state.coords.wgs84.lat, state.coords.wgs84.lng], mapInstance.getZoom(), { animate: true });
    }

    setStatus(`${sourceLabel} updated. Current type: ${state.activeType.toUpperCase()}.`, "success");

    if (window.innerWidth <= 640) {
        setSheetCollapsed(true);
    }
}

function setSheetCollapsed(collapsed) {
    coordSheetEl.classList.toggle("collapsed", collapsed);
    sheetToggleEl.setAttribute("aria-expanded", String(!collapsed));
}

function initMap() {
    if (!window.L) {
        setStatus("Map failed to load. Please check your network.", "error");
        return;
    }

    mapInstance = L.map("map-container", {
        zoomControl: true
    }).setView([state.coords.wgs84.lat, state.coords.wgs84.lng], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(mapInstance);

    mapMarker = L.marker([state.coords.wgs84.lat, state.coords.wgs84.lng]).addTo(mapInstance);

    mapInstance.on("click", (event) => {
        updateFromWgs84(event.latlng.lng, event.latlng.lat, "Map click");
    });

    renderActiveCoords();
    setStatus("Map loaded. Click anywhere to update coordinates.", "success");
}

function copyText(text, successMessage) {
    if (!navigator.clipboard) {
        alert("Clipboard API is not supported in this browser.");
        return;
    }

    navigator.clipboard.writeText(text)
        .then(() => {
            setStatus(successMessage, "success");
        })
        .catch(() => {
            setStatus("Copy failed. Please copy it manually.", "error");
        });
}

function locateCurrentPosition() {
    if (!navigator.geolocation) {
        setStatus("Geolocation is not supported in this browser.", "error");
        return;
    }

    locateBtn.disabled = true;
    locateBtn.textContent = "Locating...";
    setStatus("Requesting your current position...", "warning");

    navigator.geolocation.getCurrentPosition(
        (position) => {
            locateBtn.disabled = false;
            locateBtn.textContent = "获取当前位置";
            updateFromWgs84(position.coords.longitude, position.coords.latitude, "Browser location");
        },
        (error) => {
            locateBtn.disabled = false;
            locateBtn.textContent = "获取当前位置";

            const messages = {
                1: "Location permission was denied.",
                2: "Location service is unavailable.",
                3: "Location request timed out."
            };

            setStatus(messages[error.code] || "Failed to get current location.", "error");
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

coordSystemEl.addEventListener("change", (event) => {
    state.activeType = event.target.value;
    renderActiveCoords();
    setStatus(`Switched to ${state.activeType.toUpperCase()}.`, "success");
});

document.getElementById("copy-lng").addEventListener("click", () => {
    copyText(formatCoord(getActiveCoords().lng), `${state.activeType.toUpperCase()} longitude copied.`);
});

document.getElementById("copy-lat").addEventListener("click", () => {
    copyText(formatCoord(getActiveCoords().lat), `${state.activeType.toUpperCase()} latitude copied.`);
});

document.getElementById("copy-all").addEventListener("click", () => {
    const active = getActiveCoords();
    copyText(
        `${formatCoord(active.lng)},${formatCoord(active.lat)}`,
        `${state.activeType.toUpperCase()} coordinates copied.`
    );
});

locateBtn.addEventListener("click", locateCurrentPosition);
sheetToggleEl.addEventListener("click", () => {
    setSheetCollapsed(!coordSheetEl.classList.contains("collapsed"));
});

window.addEventListener("load", () => {
    renderActiveCoords();
    initMap();
});
