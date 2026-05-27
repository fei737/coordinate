// 全局状态
let currentLng = "121.4737";
let currentLat = "31.2304";
let mapInstance = null;
let currentMapType = 'baidu'; // 'baidu' 或 'amap'

// DOM 元素引用
const elLng = document.getElementById('text-lng');
const elLat = document.getElementById('text-lat');
const btnBaidu = document.getElementById('btn-baidu');
const btnAmap = document.getElementById('btn-amap');

// --- 地图初始化与切换逻辑 ---

function initBaiduMap() {
    // 销毁旧容器内容
    document.getElementById('map-container').innerHTML = '';
    
    // 初始化百度地图
    mapInstance = new BMap.Map("map-container");
    const point = new BMap.Point(currentLng, currentLat);
    mapInstance.centerAndZoom(point, 15);
    mapInstance.enableScrollWheelZoom(true);

    // 默认 Marker
    const marker = new BMap.Marker(point);
    mapInstance.addOverlay(marker);

    // 点击事件
    mapInstance.addEventListener("click", function(e) {
        updateCoords(e.point.lng, e.point.lat);
        mapInstance.clearOverlays();
        const newMarker = new BMap.Marker(new BMap.Point(e.point.lng, e.point.lat));
        mapInstance.addOverlay(newMarker);
    });
}

function initAMap() {
    // 销毁旧容器内容
    document.getElementById('map-container').innerHTML = '';
    
    // 初始化高德地图
    mapInstance = new AMap.Map('map-container', {
        zoom: 15,
        center: [currentLng, currentLat]
    });

    // 默认 Marker
    const marker = new AMap.Marker({
        position: new AMap.LngLat(currentLng, currentLat)
    });
    mapInstance.add(marker);

    // 点击事件
    mapInstance.on('click', function(e) {
        updateCoords(e.lnglat.getLng(), e.lnglat.getLat());
        marker.setPosition(e.lnglat);
    });
}

// --- 状态更新与交互逻辑 ---

function updateCoords(lng, lat) {
    // 保留 6 位小数以保证精度
    currentLng = Number(lng).toFixed(6);
    currentLat = Number(lat).toFixed(6);
    
    elLng.innerText = currentLng;
    elLat.innerText = currentLat;
}

function switchMap(type) {
    if (currentMapType === type) return;
    currentMapType = type;

    if (type === 'baidu') {
        btnBaidu.classList.add('active');
        btnAmap.classList.remove('active');
        initBaiduMap();
    } else {
        btnAmap.classList.add('active');
        btnBaidu.classList.remove('active');
        initAMap();
    }
}

// --- 剪贴板功能 ---

function copyText(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            alert('复制成功: ' + text);
        }).catch(err => {
            alert('复制失败，请手动复制');
        });
    } else {
        alert('当前浏览器不支持剪贴板API');
    }
}

// --- 事件绑定 ---

btnBaidu.addEventListener('click', () => switchMap('baidu'));
btnAmap.addEventListener('click', () => switchMap('amap'));

document.getElementById('copy-lng').addEventListener('click', () => copyText(currentLng));
document.getElementById('copy-lat').addEventListener('click', () => copyText(currentLat));
document.getElementById('copy-all').addEventListener('click', () => copyText(`${currentLng},${currentLat}`));

// 页面加载完成后默认初始化百度地图
window.onload = () => {
    // 延迟检查 SDK 是否加载完毕（实际生产环境可优化为回调函数加载）
    setTimeout(() => {
        initBaiduMap();
    }, 500);
};