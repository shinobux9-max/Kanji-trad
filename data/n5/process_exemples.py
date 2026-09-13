import json
import re
from pykakasi import kakasi

kks = kakasi()


def get_reading(word):
    """Obtient la lecture en hiragana d'un morceau de texte."""
    result = kks.convert(word)
    return "".join([item["hira"] for item in result])


def bulletproof_formatter(text: str) -> str:
    """1. Supprime uniquement les astérisques (**).

    2. Isole les portions de texte qui ne sont PAS déjà entourées de balises ruby.
    3. Applique pykakasi uniquement sur ces portions non formatées pour ajouter les ruby manquants.
    4. Concatène le tout en conservant la structure d'origine.
    """
    if not text:
        return ""

    # 1. Nettoyage minimal : on supprime juste les astérisques de Markdown si besoin
    clean_text = text.replace("**", "")

    # 2. On découpe la chaîne en alternant : (ce qui est dans une balise ruby) et (le reste)
    # Le motif regex capture les blocs <ruby>...</ruby> pour les laisser intacts.
    pattern = r"(<ruby>.*?</ruby>|[^\s<]+|\s+)"
    tokens = re.findall(pattern, clean_text)

    formatted_parts = []

    for token in tokens:
        # Si le token est déjà une balise ruby ou un simple espace, on le laisse tel quel
        if token.startswith("<ruby>") or token.isspace():
            formatted_parts.append(token)
        else:
            # C'est du texte brut (conttenant potentiellement des kanjis non formattés)
            # On utilise pykakasi pour convertir les parties de ce token si nécessaire
            result = kks.convert(token)
            token_formatted = []

            for item in result:
                orig = item["orig"]
                hira = item["hira"]

                # Si le morceau contient des kanjis et diffère de sa lecture
                if re.search(r"[\u4e00-\u9faf]", orig) and orig != hira:
                    token_formatted.append(
                        f"<ruby>{orig}<rt>{hira}</rt></ruby>"
                    )
                else:
                    token_formatted.append(orig)

            formatted_parts.append("".join(token_formatted))

    return "".join(formatted_parts).strip()


def update_exemples_json(filename="exemples.json"):
    try:
        with open(filename, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Erreur : Le fichier '{filename}' est introuvable dans le dossier.")
        return

    count = 0

    # Fonction récursive ou itérative pour gérer les dictionnaires imbriqués (ex: "vocab": {"n5_v_1": [...]})
    def process_node(node):
        nonlocal count
        if isinstance(node, dict):
            for k, v in node.items():
                process_node(v)
        elif isinstance(node, list):
            for ex in node:
                if isinstance(ex, dict) and "japanese" in ex:
                    original_jp = ex["japanese"]
                    ex["japanese"] = bulletproof_formatter(original_jp)
                    count += 1

    process_node(data)

    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(
        f"Succès total ! {count} phrases ont été complétées/reformattées dans '{filename}'."
    )


if __name__ == "__main__":
    update_exemples_json("exemples.json")