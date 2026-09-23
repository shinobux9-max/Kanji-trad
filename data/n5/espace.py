import re

# Exemple d'un mot mélangé
texte_brut = "手を洗ってから、ごはんを食べます。"

# Cette regex cherche un kanji (ou plusieurs) collé directement à un hiragana,
# et insère un espace entre les deux à la volée.
# \u4e00-\u9faf = plage des kanji
# \u3040-\u309f = plage des hiragana
texte_isole = re.sub(
    r"([\u4e00-\u9faf]+)(?=[\u3040-\u309f])", r"\1 ", texte_brut
)

print(texte_isole)
# Résultat affiché :
# 手を洗 ってから、ごはんを食べます。