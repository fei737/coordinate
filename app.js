const COORD_PRECISION = 6;
const PI = Math.PI;
const X_PI = (PI * 3000.0) / 180.0;
const A = 6378245.0;
const EE = 0.00669342162296594323;

const TEXT = {
    mapClick: "\u5730\u56fe\u70b9\u51fb\u5750\u6807",
    mapLoadFailed: "\u5730\u56fe\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u8fde\u63a5\u3002",
    mapLoaded: "\u5730\u56fe\u5df2\u52a0\u8f7d\uff0c\u70b9\u51fb\u4efb\u610f\u4f4d\u7f6e\u5373\u53ef\u53d6\u70b9\u3002",
    clipboardUnsupported: "\u5f53\u524d\u6d4f\u89c8\u5668\u4e0d\u652f\u6301\u526a\u8d34\u677f API\u3002",
    copyFailed: "\u590d\u5236\u5931\u8d25\uff0c\u8bf7\u624b\u52a8\u590d\u5236\u3002",
    geolocationUnsupported: "\u5f53\u524d\u6d4f\u89c8\u5668\u4e0d\u652f\u6301\u5b9a\u4f4d\u529f\u80fd\u3002",
    locating: "\u5b9a\u4f4d\u4e2d...",
    locateAction: "\u83b7\u53d6\u5f53\u524d\u4f4d\u7f6e",
    requestingLocation: "\u6b63\u5728\u83b7\u53d6\u5f53\u524d\u4f4d\u7f6e...",
    browserLocation: "\u6d4f\u89c8\u5668\u5b9a\u4f4d",
    permissionDenied: "\u5b9a\u4f4d\u6743\u9650\u88ab\u62d2\u7edd\u3002",
    serviceUnavailable: "\u5b9a\u4f4d\u670d\u52a1\u5f53\u524d\u4e0d\u53ef\u7528\u3002",
    requestTimedOut: "\u5b9a\u4f4d\u8bf7\u6c42\u8d85\u65f6\u3002",
    locateFailed: "\u83b7\u53d6\u5b9a\u4f4d\u5931\u8d25\u3002",
    switchedTo: "\u5df2\u5207\u6362\u5230",
    longitudeCopied: "\u5df2\u590d\u5236",
    longitudeLabel: "\u7ecf\u5ea6",
    latitudeLabel: "\u7eac\u5ea6",
    coordinateCopied: "\u5df2\u590d\u5236",
    coordSystemLabel: "\u5f53\u524d\u5750\u6807\u7cfb\uff1a",
    updated: "\u5df2\u66f4\u65b0"
};

const DEFAULT_BD09 = {
    lng: 120.617218,
    lat: 31.335877
};

const state = {
    activeType: "bd09",
    coords: {
        wgs84: { lng: 120.610677, lat: 31.330064 },
        gcj02: { lng: 120.610779, lat: 31.32987 },
        bd09: { lng: DEFAULT_BD09.lng, lat: DEFAULT_BD09.lat }
    },
    sheetCollapsed: false
};

let mapInstance = null;
let mapMarker = null;
let sheetDrag = null;

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

function gcj02ToWgs84(lng, lat) {
    if (outOfChina(lng, lat)) {
        return { lng, lat };
    }

    const converted = wgs84ToGcj02(lng, lat);
    return {
        lng: lng * 2 - converted.lng,
        lat: lat * 2 - converted.lat
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

function bd09ToGcj02(lng, lat) {
    const x = lng - 0.0065;
    const y = lat - 0.006;
    const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI);
    const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI);
    return {
        lng: z * Math.cos(theta),
        lat: z * Math.sin(theta)
    };
}

function convertFromWgs84(lng, lat) {
    const wgs84 = { lng, lat };
    const gcj02 = wgs84ToGcj02(lng, lat);
    const bd09 = gcj02ToBd09(gcj02.lng, gcj02.lat);
    return { wgs84, gcj02, bd09 };
}

function convertFromBd09(lng, lat) {
    const bd09 = { lng, lat };
    const gcj02 = bd09ToGcj02(lng, lat);
    const wgs84 = gcj02ToWgs84(gcj02.lng, gcj02.lat);
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

function getCollapsedOffset() {
    return Math.max(coordSheetEl.offsetHeight - 112, 0);
}

function applySheetPosition(offset) {
    coordSheetEl.style.transform = offset > 0 ? `translateY(${offset}px)` : "";
}

function setSheetCollapsed(collapsed) {
    state.sheetCollapsed = collapsed;
    sheetToggleEl.setAttribute("aria-expanded", String(!collapsed));
    applySheetPosition(collapsed && window.innerWidth <= 640 ? getCollapsedOffset() : 0);
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

    setStatus(`${sourceLabel}${TEXT.updated}，${TEXT.coordSystemLabel}${state.activeType.toUpperCase()}`, "success");

    if (window.innerWidth <= 640) {
        setSheetCollapsed(true);
    }
}

function initMap() {
    if (!window.L) {
        setStatus(TEXT.mapLoadFailed, "error");
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
        updateFromWgs84(event.latlng.lng, event.latlng.lat, TEXT.mapClick);
    });

    renderActiveCoords();
    setStatus(TEXT.mapLoaded, "success");
}

function copyText(text, successMessage) {
    if (!navigator.clipboard) {
        alert(TEXT.clipboardUnsupported);
        return;
    }

    navigator.clipboard.writeText(text)
        .then(() => {
            setStatus(successMessage, "success");
        })
        .catch(() => {
            setStatus(TEXT.copyFailed, "error");
        });
}

function locateCurrentPosition() {
    if (!navigator.geolocation) {
        setStatus(TEXT.geolocationUnsupported, "error");
        return;
    }

    locateBtn.disabled = true;
    locateBtn.textContent = TEXT.locating;
    setStatus(TEXT.requestingLocation, "warning");

    navigator.geolocation.getCurrentPosition(
        (position) => {
            locateBtn.disabled = false;
            locateBtn.textContent = TEXT.locateAction;
            updateFromWgs84(position.coords.longitude, position.coords.latitude, TEXT.browserLocation);
        },
        (error) => {
            locateBtn.disabled = false;
            locateBtn.textContent = TEXT.locateAction;

            const messages = {
                1: TEXT.permissionDenied,
                2: TEXT.serviceUnavailable,
                3: TEXT.requestTimedOut
            };

            setStatus(messages[error.code] || TEXT.locateFailed, "error");
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

function beginSheetDrag(event) {
    if (window.innerWidth > 640) return;

    const startY = event.clientY;
    const startOffset = state.sheetCollapsed ? getCollapsedOffset() : 0;

    sheetDrag = { startY, startOffset };
    coordSheetEl.classList.add("dragging");
    sheetToggleEl.setPointerCapture(event.pointerId);
}

function moveSheetDrag(event) {
    if (!sheetDrag || window.innerWidth > 640) return;

    const deltaY = event.clientY - sheetDrag.startY;
    const nextOffset = Math.min(Math.max(sheetDrag.startOffset + deltaY, 0), getCollapsedOffset());
    applySheetPosition(nextOffset);
}

function endSheetDrag(event) {
    if (!sheetDrag || window.innerWidth > 640) return;

    const deltaY = event.clientY - sheetDrag.startY;
    const finalOffset = Math.min(Math.max(sheetDrag.startOffset + deltaY, 0), getCollapsedOffset());

    coordSheetEl.classList.remove("dragging");
    sheetToggleEl.releasePointerCapture(event.pointerId);
    sheetDrag = null;

    setSheetCollapsed(finalOffset > getCollapsedOffset() * 0.35);
}

coordSystemEl.addEventListener("change", (event) => {
    state.activeType = event.target.value;
    renderActiveCoords();
    setStatus(`${TEXT.switchedTo} ${state.activeType.toUpperCase()}`, "success");
});

document.getElementById("copy-lng").addEventListener("click", () => {
    copyText(
        formatCoord(getActiveCoords().lng),
        `${TEXT.longitudeCopied} ${state.activeType.toUpperCase()} ${TEXT.longitudeLabel}`
    );
});

document.getElementById("copy-lat").addEventListener("click", () => {
    copyText(
        formatCoord(getActiveCoords().lat),
        `${TEXT.latitudeLabel}${TEXT.coordinateCopied} ${state.activeType.toUpperCase()}`
    );
});

document.getElementById("copy-all").addEventListener("click", () => {
    const active = getActiveCoords();
    copyText(
        `${formatCoord(active.lng)},${formatCoord(active.lat)}`,
        `${TEXT.coordinateCopied} ${state.activeType.toUpperCase()} ${TEXT.longitudeLabel}/${TEXT.latitudeLabel}`
    );
});

locateBtn.addEventListener("click", locateCurrentPosition);
sheetToggleEl.addEventListener("click", () => {
    if (sheetDrag) return;
    setSheetCollapsed(!state.sheetCollapsed);
});
sheetToggleEl.addEventListener("pointerdown", beginSheetDrag);
sheetToggleEl.addEventListener("pointermove", moveSheetDrag);
sheetToggleEl.addEventListener("pointerup", endSheetDrag);
sheetToggleEl.addEventListener("pointercancel", endSheetDrag);

window.addEventListener("resize", () => {
    applySheetPosition(state.sheetCollapsed && window.innerWidth <= 640 ? getCollapsedOffset() : 0);
});

window.addEventListener("load", () => {
    state.coords = convertFromBd09(DEFAULT_BD09.lng, DEFAULT_BD09.lat);
    renderActiveCoords();
    initMap();
    setSheetCollapsed(false);
});
