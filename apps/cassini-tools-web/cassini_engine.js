// Cassini Tools - Web Transformation Engine (JS port, parity-checked with Python)
// Kenya Cassini-Soldner (Clarke 1858, feet) <-> UTM Arc 1960
'use strict';
const CassiniEngine = (() => {
  const FT = 0.3048;
  const A_CASS_FT = 20926348.0;
  const A_CASS = A_CASS_FT * FT;                 // 6378350.8704
  const RF_CASS = A_CASS_FT / (A_CASS_FT - 20855233.0);
  const F_CASS = 1.0 / RF_CASS;
  const E2_CASS = F_CASS * (2 - F_CASS);
  const TOWGS84 = [-160.0, -6.0, -302.0];
  const A_C80 = 6378249.145, RF_C80 = 293.465;
  const F_C80 = 1.0 / RF_C80, E2_C80 = F_C80 * (2 - F_C80);
  const CENTRAL_MERIDIANS = [35, 37, 39, 41];
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;

  function _M(phi, a, e2) {
    const e4 = e2*e2, e6 = e4*e2;
    return a*((1 - e2/4 - 3*e4/64 - 5*e6/256)*phi
      - (3*e2/8 + 3*e4/32 + 45*e6/1024)*Math.sin(2*phi)
      + (15*e4/256 + 45*e6/1024)*Math.sin(4*phi)
      - (35*e6/3072)*Math.sin(6*phi));
  }

  function geodeticToCassini(lon, lat, lon0) {
    const a=A_CASS, e2=E2_CASS;
    const phi=rad(lat), dlam=rad(lon)-rad(lon0);
    const N=a/Math.sqrt(1-e2*Math.sin(phi)**2);
    const T=Math.tan(phi)**2;
    const A=dlam*Math.cos(phi);
    const C=e2/(1-e2)*Math.cos(phi)**2;
    const M=_M(phi,a,e2);
    const X=N*(A - T*A**3/6 - (8 - T + 8*C)*T*A**5/120);
    const Y=M + N*Math.tan(phi)*(A**2/2 + (5 - T + 6*C)*A**4/24);
    return [X/FT, Y/FT];
  }

  function cassiniToGeodetic(Xft, Yft, lon0) {
    const a=A_CASS, e2=E2_CASS;
    const X=Xft*FT, Y=Yft*FT, M1=Y;
    const e1=(1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
    const mu=M1/(a*(1-e2/4-3*e2**2/64-5*e2**3/256));
    const phi1=mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)
      +(21*e1**2/16-55*e1**4/32)*Math.sin(4*mu)
      +(151*e1**3/96)*Math.sin(6*mu)+(1097*e1**4/512)*Math.sin(8*mu);
    if (Math.abs(phi1) > Math.PI/2 - 1e-12) return [lon0, deg(phi1)];
    const N1=a/Math.sqrt(1-e2*Math.sin(phi1)**2);
    const R1=a*(1-e2)/Math.pow(1-e2*Math.sin(phi1)**2,1.5);
    const T1=Math.tan(phi1)**2, D=X/N1;
    const phi=phi1-(N1*Math.tan(phi1)/R1)*(D**2/2-(1+3*T1)*D**4/24);
    const lam=rad(lon0)+(D-T1*D**3/3+(1+3*T1)*T1*D**5/15)/Math.cos(phi1);
    return [deg(lam), deg(phi)];
  }

  function geodeticToEcef(lon,lat,a,e2,h=0){
    const lam=rad(lon), phi=rad(lat);
    const N=a/Math.sqrt(1-e2*Math.sin(phi)**2);
    return [(N+h)*Math.cos(phi)*Math.cos(lam),(N+h)*Math.cos(phi)*Math.sin(lam),(N*(1-e2)+h)*Math.sin(phi)];
  }
  function ecefToGeodetic(x,y,z,a,e2){
    const lam=Math.atan2(y,x), p=Math.hypot(x,y);
    let phi=Math.atan2(z,p*(1-e2));
    for(let i=0;i<6;i++){const N=a/Math.sqrt(1-e2*Math.sin(phi)**2);const h=p/Math.cos(phi)-N;phi=Math.atan2(z,p*(1-e2*N/(N+h)));}
    return [deg(lam),deg(phi)];
  }
  function clarke1858ToArc1960(lon,lat){const [x,y,z]=geodeticToEcef(lon,lat,A_CASS,E2_CASS);return ecefToGeodetic(x,y,z,A_C80,E2_C80);}
  function arc1960ToClarke1858(lon,lat){const [x,y,z]=geodeticToEcef(lon,lat,A_C80,E2_C80);return ecefToGeodetic(x,y,z,A_CASS,E2_CASS);}

  function geodeticToUtm(lon,lat,zone,south){
    const a=A_C80,e2=E2_C80,lon0=zone*6-183,k0=0.9996;
    const FE=500000.0,FN=south?10000000.0:0.0;
    const phi=rad(lat),lam=rad(lon),lam0=rad(lon0);
    const N=a/Math.sqrt(1-e2*Math.sin(phi)**2),T=Math.tan(phi)**2;
    const C=e2/(1-e2)*Math.cos(phi)**2,A=Math.cos(phi)*(lam-lam0),M=_M(phi,a,e2);
    const E=FE+k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*e2/(1-e2))*A**5/120);
    const Nn=FN+k0*(M+N*Math.tan(phi)*(A**2/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*e2/(1-e2))*A**6/720));
    return [E,Nn];
  }
  function utmToGeodetic(E,Nn,zone,south){
    const a=A_C80,e2=E2_C80,lon0=zone*6-183,k0=0.9996;
    const FE=500000.0,FN=south?10000000.0:0.0,x=E-FE,y=Nn-FN,M=y/k0;
    const mu=M/(a*(1-e2/4-3*e2**2/64-5*e2**3/256));
    const e1=(1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
    const phi1=mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)+(21*e1**2/16-55*e1**4/32)*Math.sin(4*mu)+(151*e1**3/96)*Math.sin(6*mu)+(1097*e1**4/512)*Math.sin(8*mu);
    const N1=a/Math.sqrt(1-e2*Math.sin(phi1)**2),T1=Math.tan(phi1)**2,C1=e2/(1-e2)*Math.cos(phi1)**2;
    const R1=a*(1-e2)/Math.pow(1-e2*Math.sin(phi1)**2,1.5),D=x/(N1*k0);
    const phi=phi1-(N1*Math.tan(phi1)/R1)*(D**2/2-(5+3*T1+10*C1-4*C1*C1-9*e2/(1-e2))*D**4/24+(61+90*T1+298*C1+45*T1*T1-252*e2/(1-e2)-3*C1*C1)*D**6/720);
    const lam=rad(lon0)+(D-(1+2*T1+C1)*D**3/6+(5-2*C1+28*T1-3*C1*C1+8*e2/(1-e2)+24*T1*T1)*D**5/120)/Math.cos(phi1);
    return [deg(lam),deg(phi)];
  }

  function beltZone(cm){ return parseInt(cm)===35 ? 36 : 37; }

  function cassiniFtToUtmRaw(cx,cy,cm,south,zone){
    if(zone==null) zone=beltZone(cm);
    let [lon,lat]=cassiniToGeodetic(cx,cy,cm);[lon,lat]=clarke1858ToArc1960(lon,lat);
    return geodeticToUtm(lon,lat,zone,south);
  }
  function utmToCassiniFtRaw(E,N,cm,south,zone){
    if(zone==null) zone=beltZone(cm);
    let [lon,lat]=utmToGeodetic(E,N,zone,south);[lon,lat]=arc1960ToClarke1858(lon,lat);
    return geodeticToCassini(lon,lat,cm);
  }

  function _taper(nearest,taper){
    if(nearest<=0.5*taper)return 1.0;
    if(nearest>=taper)return 0.0;
    const x=(nearest-0.5*taper)/(0.5*taper);
    return 0.5*(1.0+Math.cos(Math.PI*x));
  }

  class ControlNet {
    constructor(data){this.meta=data.meta;this.groups=data.control;this.zones=(data.meta&&data.meta.zones)||{};}
    _key(cm,south){return `${cm}${south?'S':'N'}`;}
    zoneFor(cm,south){const z=this.zones[this._key(cm,south)];return z?z:beltZone(cm);}
    correctForward(cm,south,cx,cy,pe,pn,k=8,taperFt=200000.0){
      const pts=this.groups[this._key(cm,south)];if(!pts)return[pe,pn,null];
      const d=pts.map(p=>[(p[0]-cx)**2+(p[1]-cy)**2,p]).sort((a,b)=>a[0]-b[0]).slice(0,Math.min(k,pts.length));
      let ws=0,de=0,dn=0;
      for(const[d2,p]of d){const[ppe,ppn]=cassiniFtToUtmRaw(p[0],p[1],cm,south);const re=p[2]-ppe,rn=p[3]-ppn,w=1/(d2+1500**2);ws+=w;de+=w*re;dn+=w*rn;}
      de/=ws;dn/=ws;const near=Math.sqrt(d[0][0]);const bl=_taper(near,taperFt);
      return[pe+bl*de,pn+bl*dn,near];
    }
    correctInverse(cm,south,ue,un,k=8,taperM=60000.0){
      const pts=this.groups[this._key(cm,south)];if(!pts)return[0,0,null];
      const d=pts.map(p=>[(p[2]-ue)**2+(p[3]-un)**2,p]).sort((a,b)=>a[0]-b[0]).slice(0,Math.min(k,pts.length));
      let ws=0,de=0,dn=0;
      for(const[d2,p]of d){const[ppe,ppn]=cassiniFtToUtmRaw(p[0],p[1],cm,south);const re=p[2]-ppe,rn=p[3]-ppn,w=1/(d2+1500**2);ws+=w;de+=w*re;dn+=w*rn;}
      de/=ws;dn/=ws;const near=Math.sqrt(d[0][0]);const bl=_taper(near,taperM);
      return[bl*de,bl*dn,near];
    }
  }

  function detectBeltFromCassini(cx,cy,net,south=null){
    let hemis;
    if(south===null){hemis = cy>5000?[false]:(cy<-5000?[true]:[false,true]);}else{hemis=[south];}
    let best=null;
    for(const cm of CENTRAL_MERIDIANS)for(const s of hemis){
      const pts=net.groups[`${cm}${s?'S':'N'}`];if(!pts)continue;
      let dmin=Infinity;for(const p of pts){const dd=(p[0]-cx)**2+(p[1]-cy)**2;if(dd<dmin)dmin=dd;}
      if(best===null||dmin<best[0])best=[dmin,cm,s];
    }
    return best?[best[1],best[2],Math.sqrt(best[0])]:[null,null,null];
  }
  function detectBeltFromUtm(E,N,net){
    const south=N>5e6;let best=null;
    for(const cm of CENTRAL_MERIDIANS){const pts=net.groups[`${cm}${south?'S':'N'}`];if(!pts)continue;
      let dmin=Infinity;for(const p of pts){const dd=(p[2]-E)**2+(p[3]-N)**2;if(dd<dmin)dmin=dd;}
      if(best===null||dmin<best[0])best=[dmin,cm];}
    return best?[best[1],south,Math.sqrt(best[0])]:[null,south,null];
  }

  function convert(a,b,cm,south,dir,net,useCtrl=true){
    if(dir==='c2u'){
      let[e,n]=cassiniFtToUtmRaw(a,b,cm,south);
      if(useCtrl&&net){return net.correctForward(cm,south,a,b,e,n);}
      return[e,n,null];
    }else{
      let E=a,N=b,near=null,E2=a,N2=b;
      if(useCtrl&&net){const[de,dn,nr]=net.correctInverse(cm,south,E,N);near=nr;E2=E-de;N2=N-dn;}
      const[cx,cy]=utmToCassiniFtRaw(E2,N2,cm,south);
      return[cx,cy,near];
    }
  }

  function proj4String(cm,towgs84=true){
    let s=`+proj=cass +lat_0=0 +lon_0=${cm} +x_0=0 +y_0=0 +a=${A_CASS.toFixed(4)} +rf=${RF_CASS.toFixed(5)} +units=ft +no_defs`;
    if(towgs84)s=s.replace('+no_defs',`+towgs84=${TOWGS84.join(',')} +no_defs`);
    return s;
  }

  function epsgTarget(cm,south){
    const zone=beltZone(cm);
    if(zone===36) return south?'EPSG:21096':'EPSG:21036';
    return south?'EPSG:21037':'EPSG:21097';
  }

  // --- Arc 1960 (Clarke 1880) geodetic -> WGS84 geodetic, using TOWGS84 (display-grade) ---
  function arc1960ToWgs84(lon,lat){
    const [x,y,z]=geodeticToEcef(lon,lat,A_C80,E2_C80);
    const A_WGS=6378137.0, F_WGS=1/298.257223563, E2_WGS=F_WGS*(2-F_WGS);
    return ecefToGeodetic(x+TOWGS84[0],y+TOWGS84[1],z+TOWGS84[2],A_WGS,E2_WGS);
  }
  // UTM (Arc 1960) easting/northing -> WGS84 [lon,lat] for web maps
  function utmToWgs84(E,N,zone,south){
    const [lon,lat]=utmToGeodetic(E,N,zone,south);
    return arc1960ToWgs84(lon,lat);
  }

  return {FT,A_CASS,RF_CASS,TOWGS84,CENTRAL_MERIDIANS,beltZone,epsgTarget,geodeticToCassini,cassiniToGeodetic,
    cassiniFtToUtmRaw,utmToCassiniFtRaw,geodeticToUtm,utmToGeodetic,clarke1858ToArc1960,arc1960ToClarke1858,
    arc1960ToWgs84,utmToWgs84,ControlNet,detectBeltFromCassini,detectBeltFromUtm,
    convert,proj4String};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = CassiniEngine;
if (typeof window !== 'undefined') window.CassiniEngine = CassiniEngine;
