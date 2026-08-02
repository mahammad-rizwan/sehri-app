const GMAPS_KEY = 'AIzaSyAWQfQB0HfybB3h-yflpD1Dws6EuhY-8go';

const ZONE_COORDS = {
  distributor: { lat: 12.896781, lng: 77.492520 },
  masjid:      { lat: 12.9227319, lng: 77.4967204 },
  stanza:      { lat: 12.9241783, lng: 77.5027661 },
  boys_hostel: { lat: 12.9248564, lng: 77.4984980 },
  girls_center:{ lat: 12.9235,    lng: 77.5040 },
};

const GIRLS_ZONE_ADDRESSES = [
  { lat: 12.915364144815069, lng: 77.49335017975658 },
  { lat: 12.91419897255419,  lng: 77.4970712624044 },
  { lat: 12.91570659098925,  lng: 77.50097029509902 },
  { lat: 12.92380582790466,  lng: 77.50373602588688 },
  { lat: 12.915201817076271, lng: 77.50574491044165 },
  { lat: 12.92328917158393,  lng: 77.5067395085923 },
  { lat: 12.924111557207349, lng: 77.5059035085923 },
  { lat: 12.924099399535349, lng: 77.5058613085923 },
  { lat: 12.923876557374848, lng: 77.50586402393485 },
  { lat: 12.923720485760734, lng: 77.50579030859228 },
  { lat: 12.9235149005565,   lng: 77.50469629694862 },
  { lat: 12.92376968571744,  lng: 77.50265715277057 },
  { lat: 12.923668492451107, lng: 77.50267850549456 },
  { lat: 12.924408039697022, lng: 77.50268363108191 },
  { lat: 12.924348454134918, lng: 77.50285152258107 },
  { lat: 12.924592698187322, lng: 77.50216465549661 },
  { lat: 12.923720967533537, lng: 77.50495457595349 },
  { lat: 12.922765307379874, lng: 77.50478405498131 },
  { lat: 12.92292208094766,  lng: 77.50566864866036 },
  { lat: 12.922738866847084, lng: 77.50588426715788 },
  { lat: 12.923428332652984, lng: 77.50565654271148 },
  { lat: 12.923442057560338, lng: 77.50597773722843 },
  { lat: 12.923727666180895, lng: 77.50573164456233 },
  { lat: 12.923877332821611, lng: 77.50592409304934 },
  { lat: 12.92392504313272,  lng: 77.50580473473313 },
  { lat: 12.923808708383447, lng: 77.50609240169052 },
  { lat: 12.923469684258185, lng: 77.50674837557953 },
];

const PIN_PATH = 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';

const NO_RIDER_HTML = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100%;
  background:linear-gradient(135deg,#050D16 0%,#0D1B2A 55%,#152336 100%);
  display:flex;align-items:center;justify-content:center;font-family:sans-serif;}
.c{text-align:center;padding:20px;}
.i{font-size:48px;margin-bottom:12px;}
.t{color:#8892A0;font-size:15px;line-height:24px;}
.b{color:#C9A84C;font-size:13px;margin-top:8px;}
</style></head><body>
<div class="c">
  <div class="i">🛵</div>
  <div class="t">Live map appears here<br/>once the rider starts delivery</div>
  <div class="b">Check back when the rider is active</div>
</div></body></html>`;

function buildMapHtml(lat: number, lng: number) {
  let girlsPinsJs = '';
  for (const p of GIRLS_ZONE_ADDRESSES) {
    girlsPinsJs += `{lat:${p.lat},lng:${p.lng}},`;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body,#map{width:100%;height:100%;overflow:hidden;}
.mw{position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;}
.rg{position:absolute;width:40px;height:40px;border-radius:50%;border:2px solid #4CAF50;animation:rp 1.8s ease-out infinite;}
.rg2{animation-delay:.6s;}
@keyframes rp{0%{transform:scale(.4);opacity:.9}100%{transform:scale(1.8);opacity:0}}
.pd{width:30px;height:30px;border-radius:50%;background:rgba(201,168,76,.15);border:2px solid #C9A84C;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 10px rgba(201,168,76,.45);}
.marker-label{color:#fff;font-size:10px;font-weight:700;text-align:center;text-shadow:0 1px 3px rgba(0,0,0,.8);margin-top:2px;}
</style>
</head>
<body>
<div id="map"></div>
<script>
var map,overlay,bounds;
var ALL_PINS=[{lat:${ZONE_COORDS.masjid.lat},lng:${ZONE_COORDS.masjid.lng}},{lat:${ZONE_COORDS.distributor.lat},lng:${ZONE_COORDS.distributor.lng}},{lat:${ZONE_COORDS.stanza.lat},lng:${ZONE_COORDS.stanza.lng}},{lat:${ZONE_COORDS.boys_hostel.lat},lng:${ZONE_COORDS.boys_hostel.lng}},${girlsPinsJs}];
function pinIcon(color){
  return {path:'${PIN_PATH}',fillColor:color,fillOpacity:1,strokeColor:'#fff',strokeWeight:1.5,scale:1.1,anchor:new google.maps.Point(12,22),labelOrigin:new google.maps.Point(12,8)};
}
function initMap(){
  map=new google.maps.Map(document.getElementById('map'),{
    center:{lat:${lat},lng:${lng}},zoom:15,
    styles:[
      {elementType:'geometry',stylers:[{color:'#0d1b2a'}]},
      {elementType:'labels.text.fill',stylers:[{color:'#8899aa'}]},
      {elementType:'labels.text.stroke',stylers:[{color:'#0d1b2a'}]},
      {featureType:'road',elementType:'geometry',stylers:[{color:'#1e3248'}]},
      {featureType:'road.highway',elementType:'geometry',stylers:[{color:'#243c56'}]},
      {featureType:'water',elementType:'geometry',stylers:[{color:'#060f1a'}]},
      {featureType:'poi',elementType:'geometry',stylers:[{color:'#111f30'}]},
      {featureType:'transit',elementType:'geometry',stylers:[{color:'#111f30'}]},
      {featureType:'administrative',elementType:'geometry.stroke',stylers:[{color:'#1a3a55'}]},
    ],
    disableDefaultUI:true,zoomControl:true,
    gestureHandling:'greedy',clickableIcons:false
  });
  // Masjid — RED
  new google.maps.Marker({position:{lat:${ZONE_COORDS.masjid.lat},lng:${ZONE_COORDS.masjid.lng}},map,icon:pinIcon('#EF5350'),label:{text:'🕌',fontSize:12,color:'#fff',className:'marker-label'}});
  // Distributor — TEAL
  new google.maps.Marker({position:{lat:${ZONE_COORDS.distributor.lat},lng:${ZONE_COORDS.distributor.lng}},map,icon:pinIcon('#00BFA5'),label:{text:'📦',fontSize:12,color:'#fff',className:'marker-label'}});
  // Girls — PINK pins (same style as orange zone pins)
  var GIRLS_PINS=[${girlsPinsJs}];
  GIRLS_PINS.forEach(function(p){
    new google.maps.Marker({position:{lat:p.lat,lng:p.lng},map,icon:pinIcon('#EC407A'),label:{text:'🌸',fontSize:12,color:'#fff',className:'marker-label'},optimized:false});
  });
  // Stanza — ORANGE
  new google.maps.Marker({position:{lat:${ZONE_COORDS.stanza.lat},lng:${ZONE_COORDS.stanza.lng}},map,icon:pinIcon('#FF9800'),label:{text:'🏡',fontSize:12,color:'#fff',className:'marker-label'}});
  // Boys Hostel — ORANGE
  new google.maps.Marker({position:{lat:${ZONE_COORDS.boys_hostel.lat},lng:${ZONE_COORDS.boys_hostel.lng}},map,icon:pinIcon('#FF9800'),label:{text:'🏠',fontSize:12,color:'#fff',className:'marker-label'}});
  // Fit map to show all pins
  bounds=new google.maps.LatLngBounds();
  ALL_PINS.forEach(function(p){bounds.extend(p);});
  map.fitBounds(bounds);
  createOverlay(${lat},${lng});
}
function createOverlay(lat,lng){
  if(overlay)overlay.setMap(null);
  var Ov=function(p){this.pos=p;this.setMap(map);};
  Ov.prototype=new google.maps.OverlayView();
  Ov.prototype.onAdd=function(){
    var d=document.createElement('div');
    d.style.position='absolute';
    d.innerHTML='<div class="mw"><div class="rg"></div><div class="rg rg2"></div><div class="pd">&#128757;</div></div>';
    this._d=d;this.getPanes().overlayMouseTarget.appendChild(d);
  };
  Ov.prototype.draw=function(){
    var p=this.getProjection().fromLatLngToDivPixel(this.pos);
    if(p){this._d.style.left=(p.x-20)+'px';this._d.style.top=(p.y-20)+'px';}
  };
  Ov.prototype.onRemove=function(){
    if(this._d){this._d.parentNode.removeChild(this._d);this._d=null;}
  };
  overlay=new Ov(new google.maps.LatLng(lat,lng));
}
function updatePin(lat,lng){
  createOverlay(lat,lng);
}
</script>
<script src="https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&callback=initMap" async defer></script>
<script>
  // Show error if Maps fails to load after 8 seconds
  setTimeout(function() {
    if (typeof google === 'undefined') {
      document.getElementById('map').innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#050D16;color:#8899AA;font-family:sans-serif;padding:20px;text-align:center"><div style=\\"font-size:40px;margin-bottom:12px\\">🗺️</div><div style=\\"font-size:15px;margin-bottom:8px;color:#fff\\">Map unavailable</div><div style=\\"font-size:12px\\">Check internet connection or Maps API key</div></div>';
    }
  }, 8000);
</script>
</body>
</html>`;
}

export { buildMapHtml, NO_RIDER_HTML };
