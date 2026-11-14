"""
Assign every H3 res-5 cell that ever had a fire detection to a biome, for biome-specific calibration.

Source: RESOLVE Ecoregions 2017 (Dinerstein et al. 2017, BioScience; CC BY 4.0), its BIOME_NUM field. Download:
https://storage.googleapis.com/teow2016/Ecoregions2017.zip  -> unzip into data/biomes/.
A cell takes the biome of the polygon containing its centre; centres that fall just offshore take the nearest biome
within 0.5 degrees; anything else is "other". The 14 biomes are merged into 8 groups so each has enough fire to calibrate.
Writes pipeline/cell_biome.npz (h3, group) and prints the cell counts per group.
"""
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from h3.api import numpy_int as h3i

ROOT = Path(__file__).resolve().parent.parent
GROUPS = {  # BIOME_NUM -> group id
    1: 0, 3: 0, 14: 0,  # tropical and subtropical moist forests, coniferous forests, mangroves
    2: 1,  # tropical dry broadleaf forests
    4: 2, 5: 2,  # temperate forests
    6: 3,  # boreal forests / taiga
    7: 4, 9: 4,  # tropical grasslands, savannas and shrublands, flooded grasslands
    8: 5, 10: 5,  # temperate and montane grasslands and shrublands
    12: 6,  # mediterranean
    13: 7, 11: 7,  # deserts and tundra
}
NAMES = ["Tropical moist forest", "Tropical dry forest", "Temperate forest", "Boreal forest", "Tropical savanna and grassland", "Temperate and montane grassland", "Mediterranean", "Desert and tundra"]
OTHER = 7


def main():
    z = np.load(Path(__file__).parent / "cell_country.npz")
    uniq = z["h3"]
    ll = np.array([h3i.cell_to_latlng(int(x)) for x in uniq])
    pts = gpd.GeoDataFrame({"i": np.arange(len(uniq))}, geometry=gpd.points_from_xy(ll[:, 1], ll[:, 0]), crs="EPSG:4326")
    eco = gpd.read_file(ROOT / "data" / "biomes" / "Ecoregions2017.shp")[["BIOME_NUM", "geometry"]]
    eco = eco[eco["BIOME_NUM"].isin(GROUPS)].to_crs("EPSG:4326")
    j = gpd.sjoin(pts, eco, how="left", predicate="within").drop_duplicates("i")
    biome = j.set_index("i")["BIOME_NUM"].reindex(range(len(uniq)))
    miss = biome.isna().to_numpy()
    print(f"{(~miss).sum():,} cells inside a biome polygon, {miss.sum():,} outside", flush=True)
    if miss.any():
        near = gpd.sjoin_nearest(pts[miss].to_crs("EPSG:3857"), eco.to_crs("EPSG:3857"), how="left", max_distance=55000).drop_duplicates("i")
        biome.loc[near["i"].to_numpy()] = near["BIOME_NUM"].to_numpy()
    group = biome.map(GROUPS).fillna(OTHER).astype(np.uint8).to_numpy()
    np.savez_compressed(Path(__file__).parent / "cell_biome.npz", h3=uniq, group=group)
    for g, n in enumerate(NAMES):
        print(f"  {g} {n}: {(group == g).sum():,} cells")


if __name__ == "__main__":
    sys.exit(main())
