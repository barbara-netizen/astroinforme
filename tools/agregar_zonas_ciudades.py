#!/usr/bin/env python3
"""Asigna a cada ciudad de cities.txt su zona IANA con polígonos exactos (timezonefinder).
Primera línea del archivo: «#zonas<TAB>zona0<TAB>zona1…». Séptima columna de cada ciudad: índice de la zona.
Volver a correr si cambia la lista de ciudades: python3 tools/agregar_zonas_ciudades.py"""
from timezonefinder import TimezoneFinder
tf = TimezoneFinder(in_memory=True)
lines = [l.split("\t")[:6] for l in open("cities.txt", encoding="utf8").read().split("\n") if l and not l.startswith("#")]
zones, rows, fall = {}, [], 0
for r in lines:
    z = tf.timezone_at(lat=float(r[4]), lng=float(r[5]))
    if not z or z.startswith("Etc/"):
        fall += 1; z = None
    i = "" if z is None else zones.setdefault(z, len(zones))
    rows.append("\t".join(r + [str(i)]))
open("cities.txt", "w", encoding="utf8").write("\n".join(["#zonas\t" + "\t".join(zones)] + rows))
print(len(rows), "ciudades,", len(zones), "zonas,", fall, "sin zona por polígono")
