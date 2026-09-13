import json
import re


def remove_ruby_duplicates(text: str) -> str:
    """Nettoie les doublons de texte créés par les erreurs de script précédentes

    (ex: <ruby>映画<rt>えいが</rt></ruby>えいが を -> <ruby>映画<rt>えいが</rt></ruby> を)
    """
    if not text:
        return ""

    # Expression régulière qui cherche une balise ruby fermée
    # suivie immédiatement par des caractères identiques (ou proches)
    # Pattern simplifié : supprime le texte dupliqué s'il est collé après </rt></ruby>
    # Exemple : <ruby>見<rt>けん</rt></ruby> みた -> <ruby>見<rt>み</rt></ruby>た
    cleaned = re.sub(
        r"(<ruby>.*?</rt></ruby>)\s*[\u3040-\u309f\u30a0-\u30ff]+", r"\1", text
    )

    return cleaned


def clean_json_file(filename="exemples.json"):
    try:
        with open(filename, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print("Fichier introuvable.")
        return

    count = 0
    for grammar_id, examples in data.items():
        if isinstance(examples, list):
            for ex in examples:
                if "japanese" in ex:
                    ex["japanese"] = remove_ruby_duplicates(ex["japanese"])
                    count += 1

    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Nettoyage des doublons terminé pour {count} phrases !")


if __name__ == "__main__":
    clean_json_file("exemples.json")