import json
import re

def format_json_single_line_highlight(filename="exemples.json"):
    try:
        # 1. Charger les données existantes
        with open(filename, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Erreur : Le fichier '{filename}' est introuvable.")
        return

    # 2. Convertir le dictionnaire en texte JSON avec l'indentation classique de 2 espaces
    json_str = json.dumps(data, ensure_ascii=False, indent=2)

    # 3. Fonction pour compacter le contenu des crochets
    def collapse_array(match):
        # match.group(1) contient tout ce qu'il y a entre les crochets de "highlight"
        content = match.group(1)
        # On supprime tous les sauts de ligne et les espaces d'indentation à l'intérieur
        content_cleaned = re.sub(r'\s*\n\s*', '', content)
        # On s'assure d'avoir un espace propre après la virgule pour la lisibilité
        content_cleaned = content_cleaned.replace('",', '", ')
        return f'"highlight": [{content_cleaned}]'

    # 4. Appliquer la Regex qui cible spécifiquement "highlight": [ ... ] (sur plusieurs lignes)
    formatted_json_str = re.sub(
        r'"highlight": \[\s*(.*?)\s*\]', 
        collapse_array, 
        json_str, 
        flags=re.DOTALL
    )

    # 5. Écrire le texte final formaté dans le fichier
    with open(filename, "w", encoding="utf-8") as f:
        f.write(formatted_json_str)

    print("Formatage terminé ! Tous les tableaux 'highlight' sont maintenant sur une seule ligne.")


if __name__ == "__main__":
    format_json_single_line_highlight("exemples.json")