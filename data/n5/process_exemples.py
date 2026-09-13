import json
import re
from pykakasi import kakasi

kks = kakasi()


def get_reading(word):
    """Obtient la lecture en hiragana d'un morceau de texte."""
    result = kks.convert(word)
    return "".join([item["hira"] for item in result])


def bulletproof_formatter(text: str) -> str:
    """1. Supprime toutes les balises, les astérisques (**) et les espaces.

    2. Isole chirurgicalement chaque kanji/bloc de ses okuriganas.
    3. Reconstruit la phrase avec le formatage parfait (ruby + espaces).
    """
    if not text:
        return ""

    # 1. Nettoyage radical : enlève les balises, les astérisques de gras et tous les espaces
    clean = re.sub(r"<.*?>", "", text)  # Supprime les balises HTML/ruby
    clean = clean.replace("**", "")  # Supprime les astérisques de Markdown
    clean = clean.replace(" ", "")  # Supprime tous les espaces existants

    # 2. Découpage de la phrase en blocs (Kanjis / Kanas / Ponctuation)
    tokens = re.findall(r"([\u4e00-\u9faf]+|[^\u4e00-\u9faf]+)", clean)

    formatted_parts = []

    for token in tokens:
        # Si le token contient des kanjis
        if re.search(r"[\u4e00-\u9faf]", token):
            # On sépare le kanji pur de sa terminaison éventuelle (ex: 知ら -> 知 + ら)
            match = re.match(r"^([\u4e00-\u9faf]+)(.*)$", token)
            if match:
                kanji_part = match.group(1)
                kana_part = match.group(2)

                kanji_reading = get_reading(kanji_part)
                formatted_token = (
                    f"<ruby>{kanji_part}<rt>{kanji_reading}</rt></ruby>{kana_part}"
                )
                formatted_parts.append(formatted_token)
            else:
                reading = get_reading(token)
                formatted_parts.append(f"<ruby>{token}<rt>{reading}</rt></ruby>")
        else:
            # C'est du kana pur ou de la ponctuation
            formatted_parts.append(token)

    # 3. Ré-espacement propre entre les mots
    raw_joined = " ".join(formatted_parts)

    # 4. Ajustements cosmétiques de la ponctuation
    cleaned = (
        raw_joined.replace(" 。", "。")
        .replace(" 、", "、")
        .replace(" ！", "！")
        .replace(" ？", "？")
        .replace("  ", " ")
    )

    return cleaned.strip()


def update_exemples_json(filename="exemples.json"):
    try:
        with open(filename, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(
            f"Erreur : Le fichier '{filename}' est introuvable dans le dossier."
        )
        return

    count = 0
    for grammar_id, examples in data.items():
        if isinstance(examples, list):
            for ex in examples:
                if "japanese" in ex:
                    original_jp = ex["japanese"]
                    ex["japanese"] = bulletproof_formatter(original_jp)
                    count += 1

    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(
        f"Succès total ! {count} phrases ont été reformattées proprement dans '{filename}'."
    )


if __name__ == "__main__":
    update_exemples_json("exemples.json")