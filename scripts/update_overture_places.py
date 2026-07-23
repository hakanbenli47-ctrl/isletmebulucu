"""Build the small, runtime-ready Turkey business index from Overture Maps.

Prerequisite:
    py -m pip install duckdb

Usage:
    py scripts/update_overture_places.py
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import duckdb


DEFAULT_RELEASE = "2026-06-17.0"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "data" / "overture-places.json"
MAX_PLACES_PER_PROVINCE_SECTOR = 1_000

PROVINCES_BY_PLATE_CODE = [
    "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya",
    "Artvin", "Aydın", "Balıkesir", "Bilecik", "Bingöl", "Bitlis", "Bolu",
    "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır",
    "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun",
    "Gümüşhane", "Hakkâri", "Hatay", "Isparta", "Mersin", "İstanbul", "İzmir",
    "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir", "Kocaeli", "Konya",
    "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş",
    "Nevşehir", "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop",
    "Sivas", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Şanlıurfa", "Uşak", "Van",
    "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman", "Kırıkkale", "Batman",
    "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük", "Kilis",
    "Osmaniye", "Düzce",
]
PROVINCE_BY_POSTCODE = {
    f"{index:02d}": province
    for index, province in enumerate(PROVINCES_BY_PLATE_CODE, start=1)
}
PROVINCE_NAMES = set(PROVINCES_BY_PLATE_CODE)

CATEGORY_TO_SECTOR = {
    "hair_salon": "Kuaför",
    "beauty_and_spa": "Güzellik merkezi",
    "beauty_salon": "Güzellik merkezi",
    "barber": "Berber",
    "freight_and_cargo_service": "Nakliyat",
    "auto_detailing": "Oto yıkama",
    "car_wash": "Oto yıkama",
    "carpet_cleaning": "Halı yıkama",
    "nail_salon": "Tırnak salonu",
}

CATEGORY_TO_PRIMARY_TYPE = {
    "hair_salon": "hair_salon",
    "beauty_and_spa": "beauty_salon",
    "beauty_salon": "beauty_salon",
    "barber": "barber_shop",
    "freight_and_cargo_service": "moving_company",
    "auto_detailing": "car_wash",
    "car_wash": "car_wash",
    "carpet_cleaning": "cleaning_service",
    "nail_salon": "nail_salon",
}

PHONE_NON_DIGITS = re.compile(r"\D+")


def normalize_mobile(values: list[str] | None) -> str | None:
    for value in values or []:
        digits = PHONE_NON_DIGITS.sub("", value)
        if digits.startswith("0090"):
            digits = digits[2:]
        if digits.startswith("90") and len(digits) == 12:
            digits = digits[2:]
        elif digits.startswith("0") and len(digits) == 11:
            digits = digits[1:]
        if len(digits) == 10 and digits.startswith("5"):
            return f"+90{digits}"
    return None


def first_contact_uri(websites: list[str] | None, socials: list[str] | None) -> str | None:
    values = [value.strip() for value in [*(websites or []), *(socials or [])] if value and value.strip()]
    for host in ("instagram.com", "facebook.com"):
        match = next((value for value in values if host in value.lower()), None)
        if match:
            return match
    return values[0] if values else None


def address_text(address: dict | None, province: str) -> str:
    address = address or {}
    parts = [address.get("freeform"), address.get("locality"), province]
    clean: list[str] = []
    for value in parts:
        value = str(value or "").strip()
        if value and all(value.casefold() not in existing.casefold() for existing in clean):
            clean.append(value)
    return ", ".join(clean) or province


def province_from_address(address: dict | None) -> str | None:
    address = address or {}
    region = str(address.get("region") or "").strip()
    if region in PROVINCE_NAMES:
        return region
    postcode = PHONE_NON_DIGITS.sub("", str(address.get("postcode") or ""))
    return PROVINCE_BY_POSTCODE.get(postcode[:2])


def download_places(release: str) -> list[tuple]:
    connection = duckdb.connect()
    connection.execute(
        "INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2'; SET threads=8;"
    )
    place_path = (
        f"s3://overturemaps-us-west-2/release/{release}/"
        "theme=places/type=place/*"
    )
    categories = ", ".join(f"'{value}'" for value in CATEGORY_TO_SECTOR)

    return connection.execute(
        f"""
        SELECT
          places.id,
          places.names.primary,
          coalesce(places.categories.primary, places.taxonomy.primary),
          places.phones,
          places.websites,
          places.socials,
          places.addresses[1],
          places.bbox.ymin,
          places.bbox.xmin,
          places.confidence,
          places.sources[1].update_time
        FROM read_parquet('{place_path}', hive_partitioning=1) AS places
        WHERE places.bbox.xmin BETWEEN 25.5 AND 45.0
          AND places.bbox.ymin BETWEEN 35.5 AND 42.5
          AND places.phones IS NOT NULL
          AND len(places.phones) > 0
          AND coalesce(places.operating_status, 'open') = 'open'
          AND coalesce(places.categories.primary, places.taxonomy.primary) IN ({categories})
          AND NOT list_contains(
            list_transform(places.sources, source -> lower(source.dataset)),
            'foursquare'
          )
        """
    ).fetchall()


def compact_places(rows: list[tuple]) -> list[list]:
    grouped: dict[tuple[str, str], list[tuple[float, list]]] = defaultdict(list)
    seen_ids: set[str] = set()
    seen_sector_mobiles: set[tuple[str, str]] = set()

    for (
        place_id,
        name,
        category,
        phones,
        websites,
        socials,
        address,
        latitude,
        longitude,
        confidence,
        updated_at,
    ) in rows:
        province = province_from_address(address)
        if not province:
            continue
        if not place_id or not name or category not in CATEGORY_TO_SECTOR:
            continue
        mobile = normalize_mobile(phones)
        if not mobile:
            continue
        sector = CATEGORY_TO_SECTOR[category]
        if place_id in seen_ids or (sector, mobile) in seen_sector_mobiles:
            continue
        seen_ids.add(place_id)
        seen_sector_mobiles.add((sector, mobile))
        contact_uri = first_contact_uri(websites, socials)
        independent_website_penalty = 1 if contact_uri and not any(
            host in contact_uri.lower()
            for host in ("instagram.com", "facebook.com", "tiktok.com", "x.com", "twitter.com")
        ) else 0
        score = independent_website_penalty * -100 + float(confidence or 0)
        compact = [
            place_id,
            str(name).strip(),
            address_text(address, province),
            province,
            mobile,
            contact_uri,
            round(float(latitude), 6),
            round(float(longitude), 6),
            CATEGORY_TO_PRIMARY_TYPE[category],
            category,
            updated_at,
        ]
        grouped[(province, sector)].append((score, compact))

    result: list[list] = []
    for key in sorted(grouped):
        ranked = sorted(grouped[key], key=lambda item: (-item[0], item[1][1].casefold()))
        result.extend(item[1] + [key[1]] for item in ranked[:MAX_PLACES_PER_PROVINCE_SECTOR])
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--release", default=DEFAULT_RELEASE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    print(f"Overture {args.release} verisi indiriliyor...")
    rows = download_places(args.release)
    print(f"{len(rows):,} ham kayıt işlendi.")
    places = compact_places(rows)
    payload = {
        "release": args.release,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "Overture Maps Foundation (Foursquare kayıtları hariç)",
        "places": places,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"{len(places):,} mobil telefonlu işletme yazıldı: {args.output}")


if __name__ == "__main__":
    main()
