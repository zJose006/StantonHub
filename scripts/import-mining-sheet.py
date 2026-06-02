import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
SOURCE_XLSX = ROOT / "data" / "star-citizen-mining-source.xlsx"
TARGET_JSON = ROOT / "data" / "mining-materials.json"

MINING_BODIES = {
    "Hurston",
    "Aberdeen",
    "Arial",
    "Ita",
    "Magda",
    "Crusader",
    "Daymar",
    "Cellin",
    "Yela",
    "ArcCorp",
    "Lyria",
    "Wala",
    "microTech",
    "Calliope",
    "Clio",
    "Euterpe",
    "Aaron Halo",
    "Yela Belt",
}

STANDALONE_AREAS = {"Aaron Halo", "Yela Belt"}


def clean(value):
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    if isinstance(value, str):
        return value.strip()
    return value


def slug(value):
    value = str(value or "").lower()
    value = value.replace("ñ", "n")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def number(value):
    value = clean(value)
    if value == "" or value == "TBD":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def percent_label(value):
    if value is None:
        return "Sin dato"
    return f"{value * 100:.1f}% estimado"


def appearance(value):
    if value is None:
        return "Sin dato"
    if value >= 0.3:
        return "Alta"
    if value >= 0.1:
        return "Media"
    if value >= 0.04:
        return "Baja"
    return "Muy baja"


def read_price_parameters():
    df = pd.read_excel(SOURCE_XLSX, sheet_name="Material Price List", header=None)
    rows = []
    active_section = ""
    for _, row in df.iterrows():
        first = clean(row.iloc[1] if len(row) > 1 else "")
        if first == "Ore Prices":
            active_section = "Mineral"
            continue
        if first == "Gemstone Prices":
            active_section = "Gema"
            continue
        if first in ("Material", ""):
            continue
        if first == "Inert Materials":
            active_section = "Inerte"
        price = number(row.iloc[2] if len(row) > 2 else None)
        if price is None:
            continue
        rows.append({
            "material": first,
            "category": active_section or "Mineral",
            "averageUnitPrice": price,
            "density": number(row.iloc[3] if len(row) > 3 else None),
            "instability": number(row.iloc[4] if len(row) > 4 else None),
            "resistance": number(row.iloc[5] if len(row) > 5 else None),
            "optimalWindowMidpoint": number(row.iloc[6] if len(row) > 6 else None),
            "optimalWindowRandomness": number(row.iloc[7] if len(row) > 7 else None),
            "optimalWindowThickness": number(row.iloc[8] if len(row) > 8 else None),
            "explosionMultiplier": number(row.iloc[9] if len(row) > 9 else None),
            "clusterFactor": number(row.iloc[10] if len(row) > 10 else None),
        })
    return {slug(row["material"]): row for row in rows}


def read_ore_locations():
    df = pd.read_excel(SOURCE_XLSX, sheet_name="Ore Locations", header=None)
    materials = [clean(value) for value in df.iloc[1, 2:].tolist()]
    densities = [number(value) for value in df.iloc[2, 2:].tolist()]
    location_map = {slug(material): [] for material in materials if material}
    current_body = ""
    for _, row in df.iloc[3:].iterrows():
        body = clean(row.iloc[0])
        location = clean(row.iloc[1])
        if body:
            current_body = body
        if location in STANDALONE_AREAS:
            current_body = location
        if current_body not in MINING_BODIES:
            continue
        if not location or not current_body:
            continue
        if location == current_body:
            continue
        for idx, material in enumerate(materials):
            if not material:
                continue
            score = number(row.iloc[idx + 2])
            if score is None:
                continue
            location_map[slug(material)].append({
                "system": "Stanton",
                "planet": current_body,
                "area": location,
                "method": "Nave",
                "deposit": "Roca superficial / asteroide",
                "appearance": appearance(score),
                "quality": percent_label(score),
                "density": densities[idx],
                "sourceScore": score,
                "notes": f"Presencia estimada segun tabla RedMonsterSC: {percent_label(score)}."
            })
    for locations in location_map.values():
        locations.sort(key=lambda item: item.get("sourceScore") or 0, reverse=True)
    return location_map


def read_refinery_bonuses():
    df = pd.read_excel(SOURCE_XLSX, sheet_name="Refinery Yield Bonuses", header=None)
    codes = [clean(value) for value in df.iloc[0, 1:10].tolist()]
    stations = [clean(value) for value in df.iloc[1, 1:10].tolist()]
    refinery_map = {}
    for _, row in df.iloc[2:].iterrows():
        material = clean(row.iloc[0])
        if not material:
            continue
        bonuses = []
        for idx, code in enumerate(codes):
            bonus = number(row.iloc[idx + 1])
            if bonus is None:
                continue
            bonuses.append({
                "code": code,
                "station": stations[idx],
                "yieldBonus": bonus,
                "label": f"{bonus * 100:+.0f}%"
            })
        bonuses.sort(key=lambda item: item["yieldBonus"], reverse=True)
        refinery_map[slug(material)] = bonuses
    return refinery_map


def read_equipment(sheet_name, name_key, header_row=0):
    df = pd.read_excel(SOURCE_XLSX, sheet_name=sheet_name, header=header_row)
    records = []
    for _, row in df.iterrows():
        name = clean(row.get(name_key))
        if not name:
            continue
        record = {}
        shops = []
        refineries = []
        for col, value in row.items():
            key = clean(col)
            val = clean(value)
            if key.startswith("Unnamed") or val == "":
                continue
            if val in ("X", "K") and re.match(r"^(HUR|CRU|ARC|MIC) L", key):
                refineries.append(key)
                continue
            if val in ("X", "K"):
                shops.append(key)
                continue
            record[camel(key)] = val
        record["name"] = name
        record["shops"] = shops
        record["refineries"] = refineries
        records.append(record)
    return records


def camel(value):
    parts = re.sub(r"[^A-Za-z0-9]+", " ", str(value)).strip().split()
    if not parts:
        return ""
    return parts[0][0].lower() + parts[0][1:] + "".join(part[:1].upper() + part[1:] for part in parts[1:])


def profit_from_price(price):
    if price is None:
        return "Sin dato"
    if price >= 150:
        return "Muy alta"
    if price >= 70:
        return "Alta"
    if price >= 25:
        return "Media"
    if price >= 5:
        return "Media-baja"
    return "Baja"


def risk_from_params(params):
    instability = params.get("instability")
    if instability is None:
        return "Sin dato"
    if instability >= 8:
        return "Muy alto"
    if instability >= 5:
        return "Alto"
    if instability >= 2:
        return "Medio"
    return "Bajo"


def quality_bands(material, params):
    if params.get("category") == "Gema":
        return [
            {"label": "Baja", "range": "Deposito pequeño", "chance": "Frecuente"},
            {"label": "Media", "range": "Deposito medio", "chance": "Media"},
            {"label": "Alta", "range": "Deposito grande", "chance": "Rara"},
        ]
    thickness = params.get("optimalWindowThickness")
    return [
        {"label": "Ventana optima", "range": f"{thickness:g}" if thickness is not None else "N/D", "chance": "Dato tecnico"},
        {"label": "Inestabilidad", "range": f"{params.get('instability'):g}" if params.get("instability") is not None else "N/D", "chance": "Riesgo"},
        {"label": "Resistencia", "range": f"{params.get('resistance'):g}" if params.get("resistance") is not None else "N/D", "chance": "Fractura"},
        {"label": "Densidad", "range": f"{params.get('density'):g}" if params.get("density") is not None else "N/D", "chance": "Masa"},
    ]


def match_material(material, index):
    names = [material.get("name", ""), *(material.get("aliases") or [])]
    for name in names:
        key = slug(name)
        if key in index:
            return key
    return None


def merge_materials(base, params, locations, refineries):
    by_key = dict(params)
    existing = base.get("materials", [])
    used = set()
    merged = []
    for material in existing:
        key = match_material(material, by_key) or slug(material.get("name"))
        source = params.get(key)
        if source:
            used.add(key)
            material["sheetData"] = source
            material["profit"] = profit_from_price(source.get("averageUnitPrice"))
            material["risk"] = risk_from_params(source)
            material["category"] = source.get("category") if source.get("category") != "Mineral" else material.get("category", "Mineral")
            material["qualityBands"] = quality_bands(material.get("name"), source)
        if key in locations and locations[key]:
            material["sheetLocations"] = locations[key]
            material["bestLocations"] = merge_locations(locations[key], material.get("bestLocations") or [])
        if key in refineries:
            material["refineryBonuses"] = refineries[key]
            material["bestRefineries"] = refineries[key][:3]
        material["sourceTags"] = sorted(set([*(material.get("sourceTags") or []), "Stanton Hub", "RedMonsterSC Sheet"]))
        merged.append(material)

    for key, source in params.items():
        if key in used or source.get("material") == "Inert Materials":
            continue
        material = {
            "id": slug(source["material"]),
            "name": source["material"],
            "aliases": [],
            "category": source.get("category") or "Mineral",
            "profit": profit_from_price(source.get("averageUnitPrice")),
            "risk": risk_from_params(source),
            "miningTypes": ["ROC"] if source.get("category") == "Gema" else ["Nave"],
            "bestLocations": locations.get(key, [])[:4],
            "sheetLocations": locations.get(key, []),
            "qualityBands": quality_bands(source["material"], source),
            "tools": ["ROC"] if source.get("category") == "Gema" else ["Prospector", "Mole"],
            "tips": tips_for(source),
            "sheetData": source,
            "refineryBonuses": refineries.get(key, []),
            "bestRefineries": refineries.get(key, [])[:3],
            "sourceTags": ["RedMonsterSC Sheet"]
        }
        merged.append(material)

    merged.sort(key=lambda item: (-(item.get("sheetData") or {}).get("averageUnitPrice", 0), item.get("name", "")))
    return merged


def merge_locations(sheet_locations, manual_locations):
    seen = set()
    result = []
    for location in [*sheet_locations[:6], *manual_locations]:
        key = (location.get("planet"), location.get("area"), location.get("method"))
        if key in seen:
            continue
        seen.add(key)
        result.append(location)
    return result[:8]


def tips_for(source):
    material = source["material"]
    if source.get("category") == "Gema":
        return [f"Usa ROC para buscar {material}.", "Prioriza depositos concentrados y evita rutas largas si el valor por minuto cae.", "Revisa si el terreno permite aterrizar cerca del deposito."]
    if source.get("instability", 0) >= 7:
        return ["Prepara refineria y ruta antes de extraer.", "Vigila inestabilidad y ventana optima durante la fractura.", "No sacrifiques la nave por una roca con mal porcentaje."]
    return ["Compara precio y porcentaje antes de llenar bodega.", "Usa la tabla de refinerias para elegir estacion con bonus positivo.", "Si aparece como relleno bajo, prioriza minerales de mayor valor."]


def main():
    base = json.loads(TARGET_JSON.read_text(encoding="utf-8"))
    params = read_price_parameters()
    locations = read_ore_locations()
    refineries = read_refinery_bonuses()
    lasers = read_equipment("Mining Lasers", "Laser")
    modules = read_equipment("Mining Modules & Gadgets", "Name")
    base["generatedAt"] = datetime.now(timezone.utc).date().isoformat()
    base["sourceNote"] = "Base minera local fusionada con datos del spreadsheet RedMonsterSC Mining Cheatsheet. Los valores pueden cambiar por parche, economia del servidor y zona exacta."
    base["sourceSpreadsheet"] = {
        "name": "RedMonsterSC Mining Cheatsheet",
        "googleSheetId": "1kIVPU0YUckjEn4ZXHiSYwfAmd6qJW2rF_Z6pJhFkJQo",
        "sheetsUsed": ["Ore Locations", "Refinery Yield Bonuses", "Mining Lasers", "Mining Modules & Gadgets", "Material Price List"],
        "importedAt": datetime.now(timezone.utc).isoformat()
    }
    base["materials"] = merge_materials(base, params, locations, refineries)
    base["equipment"] = {
        "miningLasers": lasers,
        "miningModulesAndGadgets": modules
    }
    TARGET_JSON.write_text(json.dumps(base, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "materials": len(base["materials"]),
        "lasers": len(lasers),
        "modules": len(modules),
        "withSheetData": sum(1 for item in base["materials"] if item.get("sheetData")),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
