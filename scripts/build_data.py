#!/usr/bin/env python3
"""Build Chemle's static molecule data from PubChem + RDKit.

Outputs:
  public/data/molecules.json     one entry per molecule (see MOLECULES below)
  public/molecules/<id>.sdf      3D structure with hydrogens

Usage:
  pip install -r scripts/requirements.txt
  python scripts/build_data.py

Edit `category` and `aliases` in the MOLECULES table (and FACTS) below, then re-run.
(Don't edit molecules.json by hand: it is regenerated.)
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors

RDLogger.DisableLog("rdApp.*")

ROOT = Path(__file__).resolve().parent.parent
JSON_OUT = ROOT / "public" / "data" / "molecules.json"
SDF_DIR = ROOT / "public" / "molecules"

PUG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"
REQUEST_GAP_S = 0.25  # PubChem asks for <= 5 requests/second
USER_AGENT = "chemle-build-data/1.0"

CATEGORIES = {"food", "drug", "neurotransmitter", "hormone", "vitamin", "metabolite"}


@dataclass
class Spec:
    id: str
    name: str
    category: str
    aliases: list[str] = field(default_factory=list)
    query: str | None = None  # PubChem name lookup (defaults to `name`)
    cid: int | None = None  # pin a CID when the name is ambiguous


# fmt: off
MOLECULES: list[Spec] = [
    Spec("caffeine", "Caffeine", "food", ["guaranine", "1,3,7-trimethylxanthine"]),
    Spec("theobromine", "Theobromine", "food", ["3,7-dimethylxanthine"]),
    Spec("nicotine", "Nicotine", "drug"),
    Spec("capsaicin", "Capsaicin", "food"),
    Spec("menthol", "Menthol", "food", ["l-menthol", "(-)-menthol"], cid=16666),  # natural (-)-menthol
    Spec("vanillin", "Vanillin", "food"),
    Spec("cinnamaldehyde", "Cinnamaldehyde", "food", ["cinnamal", "cinnamic aldehyde"]),
    Spec("limonene", "Limonene", "food", ["d-limonene"], cid=440917),  # (R)-(+), citrus form
    Spec("curcumin", "Curcumin", "food", ["diferuloylmethane"]),
    Spec("allicin", "Allicin", "food"),
    Spec("glucose", "Glucose", "metabolite", ["dextrose", "d-glucose", "blood sugar"]),
    Spec("fructose", "Fructose", "food", ["d-fructose", "fruit sugar", "levulose"]),
    Spec("sucrose", "Sucrose", "food", ["table sugar", "saccharose"]),
    Spec("ethanol", "Ethanol", "food", ["ethyl alcohol", "alcohol", "grain alcohol"]),
    Spec("acetic-acid", "Acetic acid", "food", ["ethanoic acid"]),
    Spec("citric-acid", "Citric acid", "food"),
    Spec("lactic-acid", "Lactic acid", "metabolite", ["2-hydroxypropanoic acid", "milk acid"],
         cid=107689),  # L-lactic acid
    Spec("ascorbic-acid", "Ascorbic acid", "vitamin", ["vitamin c", "l-ascorbic acid", "ascorbate"]),
    Spec("urea", "Urea", "metabolite", ["carbamide"]),
    Spec("aspirin", "Aspirin", "drug", ["acetylsalicylic acid", "asa"]),
    Spec("ibuprofen", "Ibuprofen", "drug", ["advil", "nurofen", "motrin"]),
    Spec("paracetamol", "Paracetamol", "drug", ["acetaminophen", "tylenol", "panadol", "apap"]),
    Spec("penicillin-g", "Penicillin G", "drug", ["benzylpenicillin", "penicillin"]),
    Spec("morphine", "Morphine", "drug"),
    Spec("quinine", "Quinine", "drug"),
    Spec("dopamine", "Dopamine", "neurotransmitter"),
    Spec("serotonin", "Serotonin", "neurotransmitter", ["5-ht", "5-hydroxytryptamine"]),
    Spec("adrenaline", "Adrenaline", "hormone", ["epinephrine"]),
    Spec("histamine", "Histamine", "neurotransmitter"),
    Spec("acetylcholine", "Acetylcholine", "neurotransmitter", ["ach"]),
    Spec("gaba", "GABA", "neurotransmitter",
         ["gamma-aminobutyric acid", "γ-aminobutyric acid", "4-aminobutanoic acid"],
         query="gamma-aminobutyric acid"),
    Spec("melatonin", "Melatonin", "hormone"),
    Spec("cortisol", "Cortisol", "hormone", ["hydrocortisone"]),
    Spec("testosterone", "Testosterone", "hormone"),
    Spec("estradiol", "Estradiol", "hormone", ["oestradiol", "17β-estradiol", "e2"]),
    Spec("cholesterol", "Cholesterol", "metabolite"),
    Spec("glycine", "Glycine", "metabolite", ["gly"]),
    Spec("tryptophan", "Tryptophan", "metabolite", ["l-tryptophan", "trp"]),
    Spec("atp", "ATP", "metabolite",
         ["adenosine triphosphate", "adenosine 5'-triphosphate"],
         query="adenosine triphosphate"),
    Spec("aspartame", "Aspartame", "food", ["nutrasweet", "equal"]),
]
# fmt: on

# One-line fact shown on the end screen (after the answer is revealed).
FACTS: dict[str, str] = {
    "caffeine": "The world's most widely consumed psychoactive drug; plants make it as a natural insecticide.",
    "theobromine": "The main stimulant in chocolate, and the reason chocolate is toxic to dogs.",
    "nicotine": "Tobacco plants produce it to poison the insects that eat their leaves.",
    "capsaicin": "Makes chili peppers hot by triggering the same receptor that senses heat; birds can't feel it.",
    "menthol": "Feels cold because it activates TRPM8, the receptor your nerves use to sense cool temperatures.",
    "vanillin": "Most vanilla flavor sold today is synthetic vanillin, once made mainly from wood pulp waste.",
    "cinnamaldehyde": "Gives cinnamon its flavor and smell, making up about 90% of cinnamon bark oil.",
    "limonene": "The citrus smell of orange peel; its mirror image smells more like turpentine.",
    "curcumin": "The bright yellow pigment of turmeric, also used as a food coloring (E100).",
    "allicin": "Forms only when garlic is crushed or cut, as an enzyme reacts with a precursor.",
    "glucose": "Your brain burns roughly 120 grams of it every day.",
    "fructose": "The sweetest natural sugar, nearly twice as sweet as table sugar.",
    "sucrose": "Table sugar: one glucose and one fructose joined together.",
    "ethanol": "Humans have been brewing it for at least 9,000 years.",
    "acetic-acid": "Gives vinegar its sour taste and sharp smell, at about 5% concentration.",
    "citric-acid": "Most of it is now made by fermenting sugar with the mold Aspergillus niger, not from citrus.",
    "lactic-acid": "Made by your muscles during hard exercise, and by bacteria when they turn milk into yogurt.",
    "ascorbic-acid": "Humans, unlike most mammals, can't make it, which is why sailors got scurvy.",
    "urea": "Friedrich Wöhler's 1828 synthesis of it helped show organic compounds could be made in a lab.",
    "aspirin": "Derived from salicylic acid, found in willow bark, which was used for pain for millennia.",
    "ibuprofen": "Discovered in the 1960s by a team at Boots in Nottingham, England.",
    "paracetamol": "One of the most used pain relievers, yet exactly how it works is still debated.",
    "penicillin-g": "Alexander Fleming noticed a mold killing his bacteria cultures in 1928.",
    "morphine": "Named after Morpheus, the Greek god of dreams.",
    "quinine": "Gives tonic water its bitter taste and glows blue under UV light.",
    "dopamine": "A key signal in the brain's reward and movement systems; its loss causes Parkinson's symptoms.",
    "serotonin": "About 90% of the body's supply is found in the gut, not the brain.",
    "adrenaline": "Drives the fight-or-flight response; it was the first hormone to be isolated, in 1901.",
    "histamine": "Released by immune cells during allergic reactions, causing itching and swelling.",
    "acetylcholine": "The first neurotransmitter ever discovered, by Otto Loewi in 1921.",
    "gaba": "The brain's main inhibitory neurotransmitter, calming down nerve activity.",
    "melatonin": "Made by the pineal gland in the dark; it signals to your body that it's night.",
    "cortisol": "The main stress hormone, peaking in the morning shortly after you wake up.",
    "testosterone": "Present in both men and women, at levels about ten times higher in men.",
    "estradiol": "The most potent natural estrogen.",
    "cholesterol": "Essential for every animal cell membrane and the starting point for steroid hormones.",
    "glycine": "The simplest amino acid, and the only one without a mirror-image form.",
    "tryptophan": "An essential amino acid the body uses to make serotonin and melatonin.",
    "atp": "Your body recycles roughly its own weight in it every day.",
    "aspartame": "Discovered by accident in 1965 when a chemist licked his finger.",
}

# Functional groups, in display order. A group is present if any SMARTS matches.
FUNCTIONAL_GROUPS: list[tuple[str, list[str]]] = [
    ("alcohol", ["[OX2H][CX4]"]),
    ("phenol", ["[OX2H]c"]),
    # C-O-C, but not the single-bonded O of an ester/acid/carbonate
    ("ether", ["[OD2;!$(O[#6]=[O,S,N])]([#6])[#6]"]),
    ("aldehyde", ["[CX3H1](=O)[#6]", "[CX3H2]=O"]),
    ("ketone", ["[#6][CX3](=O)[#6]"]),
    ("carboxylic acid", ["[CX3](=O)[OX2H1,OX1-]"]),
    ("ester", ["[#6][#6X3](=O)[OX2H0][#6]"]),
    # sp3 N not bonded to a carbonyl/thiocarbonyl or a heteroatom; plus quaternary ammonium
    ("amine", ["[NX3;!$(N[#6,#16,#15]=[O,S]);!$(N~[!#6;!#1])]", "[NX4+;!$(N~[!#6;!#1])]"]),
    ("amide", ["[#7X3][#6X3](=[OX1])"]),
    ("aromatic ring", ["a"]),
    ("halogen", ["[F,Cl,Br,I]"]),
    ("thiol/sulfide", ["[#16X2]"]),
    ("phosphate", ["[PX4](=O)([OX2,OX1-])([OX2,OX1-])[OX2,OX1-]"]),
]
_FG_PATTERNS = [(n, [Chem.MolFromSmarts(s) for s in smarts]) for n, smarts in FUNCTIONAL_GROUPS]
for _n, _ps in _FG_PATTERNS:
    assert all(p is not None for p in _ps), f"bad SMARTS for {_n}"


# ---------------------------------------------------------------- PubChem ----

_last_request = 0.0


class NotFound(Exception):
    pass


def pug_get(path: str, retries: int = 4) -> bytes:
    """GET a PUG REST path, throttled, retrying transient errors."""
    global _last_request
    url = f"{PUG}/{path}"
    for attempt in range(retries + 1):
        wait = REQUEST_GAP_S - (time.monotonic() - _last_request)
        if wait > 0:
            time.sleep(wait)
        _last_request = time.monotonic()
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise NotFound(url) from e
            if e.code not in (429, 500, 502, 503, 504) or attempt == retries:
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt == retries:
                raise
        time.sleep(2**attempt)
    raise AssertionError("unreachable")


def lookup_cids(name: str) -> list[int]:
    q = urllib.parse.quote(name, safe="")
    data = json.loads(pug_get(f"compound/name/{q}/cids/JSON"))
    return data["IdentifierList"]["CID"]


def fetch_properties(cid: int) -> dict:
    props = "IUPACName,MolecularFormula,MolecularWeight,CanonicalSMILES,IsomericSMILES"
    data = json.loads(pug_get(f"compound/cid/{cid}/property/{props}/JSON"))
    p = data["PropertyTable"]["Properties"][0]
    # PubChem renamed these in 2025: CanonicalSMILES -> ConnectivitySMILES,
    # IsomericSMILES -> SMILES. Accept either spelling.
    return {
        "iupac_name": p.get("IUPACName", ""),
        "formula": p["MolecularFormula"],
        "mw": float(p["MolecularWeight"]),
        "canonical_smiles": p.get("ConnectivitySMILES") or p["CanonicalSMILES"],
        "isomeric_smiles": p.get("SMILES") or p.get("IsomericSMILES") or p["CanonicalSMILES"],
    }


def fetch_3d_sdf(cid: int) -> str | None:
    try:
        return pug_get(f"compound/cid/{cid}/record/SDF?record_type=3d").decode()
    except NotFound:
        return None


# ----------------------------------------------------------------- RDKit -----

def generate_3d(smiles: str) -> Chem.Mol:
    """3D conformer from SMILES: ETKDGv3 embedding then MMFF (UFF fallback)."""
    mol = Chem.AddHs(Chem.MolFromSmiles(smiles))
    params = AllChem.ETKDGv3()
    params.randomSeed = 42  # deterministic output
    if AllChem.EmbedMolecule(mol, params) != 0:
        params.useRandomCoords = True
        if AllChem.EmbedMolecule(mol, params) != 0:
            raise RuntimeError(f"RDKit could not embed {smiles}")
    if AllChem.MMFFHasAllMoleculeParams(mol):
        AllChem.MMFFOptimizeMolecule(mol, maxIters=2000)
    else:
        AllChem.UFFOptimizeMolecule(mol, maxIters=2000)
    return mol


def functional_groups(mol: Chem.Mol) -> list[str]:
    return [name for name, pats in _FG_PATTERNS if any(mol.HasSubstructMatch(p) for p in pats)]


def is_3d(mol: Chem.Mol) -> bool:
    conf = mol.GetConformer()
    return any(abs(conf.GetAtomPosition(i).z) > 1e-3 for i in range(mol.GetNumAtoms()))


# ------------------------------------------------------------------ build ----

def build_one(spec: Spec) -> tuple[dict, str, list[str]]:
    warnings: list[str] = []

    if spec.cid is not None:
        cid = spec.cid
    else:
        cids = lookup_cids(spec.query or spec.name)
        cid = cids[0]
        if len(cids) > 1:
            warnings.append(f"name matched {len(cids)} CIDs {cids[:5]}; using {cid}")

    props = fetch_properties(cid)
    mol = Chem.MolFromSmiles(props["canonical_smiles"])
    if mol is None:
        raise RuntimeError(f"RDKit cannot parse SMILES {props['canonical_smiles']}")

    # 3D structure
    sdf_text = fetch_3d_sdf(cid)
    if sdf_text is not None:
        mol3d = Chem.MolFromMolBlock(sdf_text, removeHs=False)
        source = "pubchem"
        if mol3d is None:
            warnings.append("PubChem 3D SDF unreadable by RDKit; generated with RDKit")
            mol3d, source = generate_3d(props["isomeric_smiles"]), "rdkit"
    else:
        warnings.append("no PubChem 3D conformer; generated with RDKit (ETKDG+MMFF)")
        mol3d, source = generate_3d(props["isomeric_smiles"]), "rdkit"
    mol3d.SetProp("_Name", spec.name)
    for prop in list(mol3d.GetPropNames()):
        mol3d.ClearProp(prop)
    sdf_out = Chem.MolToMolBlock(mol3d) + "$$$$\n"

    # sanity checks
    if "." in props["canonical_smiles"]:
        warnings.append("SMILES has several components (salt/mixture?)")
    if any(a.GetFormalCharge() for a in mol.GetAtoms()):
        warnings.append("has formal charges")
    rd_formula = rdMolDescriptors.CalcMolFormula(mol)
    if rd_formula != props["formula"]:
        warnings.append(f"formula mismatch: PubChem {props['formula']} vs RDKit {rd_formula}")
    rd_mw = Descriptors.MolWt(mol)
    if abs(rd_mw - props["mw"]) > 0.1:
        warnings.append(f"MW mismatch: PubChem {props['mw']} vs RDKit {rd_mw:.2f}")
    if mol3d.GetNumHeavyAtoms() != mol.GetNumHeavyAtoms():
        warnings.append(
            f"SDF has {mol3d.GetNumHeavyAtoms()} heavy atoms, SMILES {mol.GetNumHeavyAtoms()}"
        )
    has_sp3 = any(a.GetHybridization() == Chem.HybridizationType.SP3
                  for a in mol.GetAtoms() if a.GetAtomicNum() > 1)
    if has_sp3 and not is_3d(mol3d):  # planar molecules (e.g. urea) are fine flat
        warnings.append("SDF coordinates are flat (not 3D)")
    iso = Chem.MolFromSmiles(props["isomeric_smiles"])
    undefined = [c for c in Chem.FindMolChiralCenters(iso, includeUnassigned=True,
                                                       useLegacyImplementation=False)
                 if c[1] == "?" and iso.GetAtomWithIdx(c[0]).GetSymbol() in ("C", "S")]
    # (N/P are skipped: bridgehead N and phosphate P are reported but aren't real
    # configurational stereocentres here)
    if undefined:
        warnings.append(f"{len(undefined)} undefined stereocentre(s)")
    if spec.category not in CATEGORIES:
        warnings.append(f"unknown category {spec.category!r}")

    entry = {
        "id": spec.id,
        "name": spec.name,
        "aliases": spec.aliases,
        "category": spec.category,
        "fact": FACTS[spec.id],
        "cid": cid,
        "iupacName": props["iupac_name"],
        "formula": props["formula"],
        "molecularWeight": round(props["mw"], 2),
        "smiles": props["canonical_smiles"],
        "isomericSmiles": props["isomeric_smiles"],
        "heavyAtoms": mol.GetNumHeavyAtoms(),
        # true SSSR size (cyclomatic number); CalcNumRings uses the symmetrized
        # SSSR, which counts quinine's bicyclic cage as 3 rings instead of 2
        "rings": len(Chem.GetSSSR(mol)),
        "aromaticRings": rdMolDescriptors.CalcNumAromaticRings(mol),
        "functionalGroups": functional_groups(mol),
        "sdfSource": source,
    }
    return entry, sdf_out, warnings


def print_summary(entries: list[dict], all_warnings: dict[str, list[str]]) -> None:
    head = ["id", "CID", "formula", "MW", "heavy", "rings", "arom", "3D", "category",
            "functional groups"]
    print("| " + " | ".join(head) + " |")
    print("|" + "|".join("---" for _ in head) + "|")
    for e in entries:
        row = [e["id"], str(e["cid"]), e["formula"], f"{e['molecularWeight']:.2f}",
               str(e["heavyAtoms"]), str(e["rings"]), str(e["aromaticRings"]),
               e["sdfSource"], e["category"], ", ".join(e["functionalGroups"])]
        print("| " + " | ".join(row) + " |")
    flagged = {k: v for k, v in all_warnings.items() if v}
    print(f"\n{len(flagged)} molecule(s) with warnings:")
    for mid, ws in flagged.items():
        for w in ws:
            print(f"  - {mid}: {w}")


def main() -> int:
    ids = [s.id for s in MOLECULES]
    assert len(ids) == len(set(ids)), "duplicate molecule ids"
    assert set(FACTS) == set(ids), "FACTS must have exactly one entry per molecule"

    SDF_DIR.mkdir(parents=True, exist_ok=True)
    JSON_OUT.parent.mkdir(parents=True, exist_ok=True)

    entries: list[dict] = []
    all_warnings: dict[str, list[str]] = {}
    failed: list[str] = []
    for spec in MOLECULES:
        try:
            entry, sdf, warnings = build_one(spec)
        except Exception as exc:  # keep going, report at the end
            print(f"FAILED {spec.id}: {exc}", file=sys.stderr)
            failed.append(spec.id)
            continue
        (SDF_DIR / f"{spec.id}.sdf").write_text(sdf)
        entries.append(entry)
        all_warnings[spec.id] = warnings
        print(f"ok  {spec.id:<15} CID {entry['cid']:<10} {entry['sdfSource']}", file=sys.stderr)

    JSON_OUT.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n")
    print(f"\nwrote {JSON_OUT.relative_to(ROOT)} ({len(entries)} molecules)\n", file=sys.stderr)
    print_summary(entries, all_warnings)
    if failed:
        print(f"\nFAILED: {', '.join(failed)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
