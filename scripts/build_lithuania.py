#!/usr/bin/env python3
"""Reproduce Life File's fictional Karsen outline from Natural Earth Lithuania.
Public-domain Natural Earth 10m Admin-0 via datasets/geo-countries.
This generator changes ONLY the embedded country boundary and the source
GeoJSON snapshot. It never remaps game logic or NPC/building state.
Run: python scripts/build_lithuania.py
"""
import json
import pathlib
import re
import urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE="https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson"
DATA=ROOT/"assets/maps/lithuania-outline.geojson"
MAP=ROOT/"js/map.js"
LON0,LAT0,LON1,LAT1=20.92457,53.88684,26.80072,56.44260

def simplify_ring(pts,tol=0.012):
    def distance(p,a,b):
        dx=b[0]-a[0];dy=b[1]-a[1]
        if dx*dx+dy*dy<1e-18:return ((p[0]-a[0])**2+(p[1]-a[1])**2)**.5
        t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)))
        return ((p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2)**.5
    def rdp(arr):
        if len(arr)<3:return arr
        d,i=max((distance(arr[k],arr[0],arr[-1]),k) for k in range(1,len(arr)-1))
        if d<=tol:return [arr[0],arr[-1]]
        return rdp(arr[:i+1])[:-1]+rdp(arr[i:])
    if pts[0]==pts[-1]:pts=pts[:-1]
    return rdp(pts+[pts[0]])

def point(lon,lat):
    return (round(14+(lon-LON0)/(LON1-LON0)*122,2),
            round(13+(LAT1-lat)/(LAT1-LAT0)*74,2))

def polygon_path(poly):
    segs=[]
    for ring in poly:
        clean=simplify_ring(ring)
        xy=[point(*p) for p in clean]
        segs.append("M "+" L ".join(f"{x:g} {y:g}" for x,y in xy)+" Z")
    return " ".join(segs)

def main():
    if DATA.is_file():
        feature=json.loads(DATA.read_text(encoding="utf8"))["features"][0]
    else:
        with urllib.request.urlopen(SOURCE,timeout=85) as r:
            features=json.load(r)["features"]
        feature=next(f for f in features if f["properties"].get("name")=="Lithuania")
        feature={"type":"Feature",
             "properties":{"name":"Lithuania","source":"Natural Earth Admin-0 10m","license":"public domain",
                           "download":SOURCE},
             "geometry":feature["geometry"]}
        DATA.parent.mkdir(parents=True,exist_ok=True)
        DATA.write_text(json.dumps({"type":"FeatureCollection","features":[feature]},
                              ensure_ascii=False,separators=(",",":")),encoding="utf8")
    geom=feature["geometry"]
    polys=geom["coordinates"] if geom["type"]=="MultiPolygon" else [geom["coordinates"]]
    path=" ".join(polygon_path(poly) for poly in polys)
    m=MAP.read_text(encoding="utf-8-sig")
    marker="  // Geographic base: Natural Earth 10m Lithuania (public domain); Karsen is fictitious.\n"
    code=marker+"  const LT_ACTUAL_BORDER="+json.dumps(path)+";\n"
    if marker in m:
        m=re.sub(r"  // Geographic base: Natural Earth 10m Lithuania \(public domain\); Karsen is fictitious\.\n  const LT_ACTUAL_BORDER=.*?;\n",
                 lambda _:code,m,count=1,flags=re.S)
    else:
        needle="  const TERRAIN={"
        assert m.count(needle)==1
        m=m.replace(needle,code+needle)
    a="border:'M 18 49 C 14 41 22 31 38 29 C 52 27 58 18 75 20 C 91 21 99 30 111 27 C 125 23 138 28 145 38 C 150 46 147 55 139 60 C 147 68 141 78 130 82 C 116 86 105 78 93 84 C 81 91 69 82 56 86 C 43 91 30 86 24 78 C 16 74 20 66 14 61 C 9 57 11 52 18 49 Z'"
    if a in m:m=m.replace(a,"border:LT_ACTUAL_BORDER")
    assert m.count("border:LT_ACTUAL_BORDER")==1
    MAP.write_text(m,encoding="utf8")
    print("Imported actual Lithuania geographic outline:",len(path),"characters;",
          sum(len(ring) for p in polys for ring in p),"source vertices;",
          len(re.findall(r"\bL\b",path)),"simplified path segments")
    print("Source: "+SOURCE)
if __name__=="__main__":main()
