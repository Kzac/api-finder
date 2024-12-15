from notion_client import Client
from datetime import datetime
from constants import KEYWORD_SUGGESTIONS

class NotionExporter:
    def __init__(self, token, database_id):
        self.notion = Client(auth=token)
        self.database_id = database_id

    def export_business(self, business_data):
        try:
            # Déterminer la catégorie et l'emoji
            keyword = business_data.get('keyword', '').lower()
            category = None
            emoji = '🏢'  # Emoji par défaut
            
            for cat, data in KEYWORD_SUGGESTIONS.items():
                if any(k.lower() in keyword for k in data['keywords']):
                    category = cat
                    emoji = data['emoji']
                    break
            
            if not category:
                category = "Autre"

            # Vérifier si l'entreprise existe déjà
            business_name = business_data.get('name', '')
            existing_pages = self.notion.databases.query(
                database_id=self.database_id,
                filter={
                    "property": "Name",
                    "title": {
                        "equals": business_name
                    }
                }
            )

            if existing_pages.get('results'):
                print(f"L'entreprise {business_name} existe déjà dans Notion")
                return existing_pages['results'][0]

            properties = {
                "Name": {
                    "title": [
                        {
                            "text": {
                                "content": business_data.get('name', 'Sans nom')
                            }
                        }
                    ]
                },
                "Titulaire": {
                    "people": []
                },
                "Checker": {
                    "rich_text": [
                        {
                            "text": {
                                "content": self.check_data_completeness(business_data)
                            }
                        }
                    ]
                },
                "Dernier contact": {
                    "date": {
                        "start": datetime.now().strftime("%Y-%m-%d")
                    }
                },
                "Contact": {
                    "rich_text": [
                        {
                            "text": {
                                "content": "À contacter"
                            }
                        }
                    ]
                },
                "Industrie": {
                    "rich_text": [
                        {
                            "text": {
                                "content": category
                            }
                        }
                    ]
                },
                "Adresse": {
                    "rich_text": [
                        {
                            "text": {
                                "content": business_data.get('address', 'Non renseignée')
                            }
                        }
                    ]
                },
                "Numéro de téléphone": {
                    "phone_number": business_data.get('phone') or None
                },
                "Email": {
                    "email": None
                },
                "Site web": {
                    "url": business_data.get('website') or None
                },
                "Montant": {
                    "number": None
                },
                "Source": {
                    "select": {
                        "name": "Pro Finder"
                    }
                }
            }

            new_page = self.notion.pages.create(
                parent={"database_id": self.database_id},
                properties=properties,
                icon={
                    "type": "emoji",
                    "emoji": emoji
                }
            )
            return new_page
        
        except Exception as e:
            print(f"Erreur détaillée lors de l'export vers Notion: {str(e)}")
            return None

    def check_data_completeness(self, business_data):
        # Vérifier les champs obligatoires
        required_fields = ['name', 'address', 'phone']
        if all(business_data.get(field) for field in required_fields):
            return "Informations complètes"
        return "Informations incomplètes"

    def get_business_category(self, keyword):
        # Référence au KEYWORD_SUGGESTIONS défini dans app.py
        keyword = keyword.lower()
        from app import KEYWORD_SUGGESTIONS  # Import local pour éviter les imports circulaires
        
        for category, keywords in KEYWORD_SUGGESTIONS.items():
            if any(k.lower() in keyword for k in keywords):
                return category
        return "Autre"  # Catégorie par défaut si aucune correspondance

    def check_business_exists(self, business_name):
        try:
            existing_pages = self.notion.databases.query(
                database_id=self.database_id,
                filter={
                    "property": "Name",
                    "title": {
                        "equals": business_name
                    }
                }
            )
            return bool(existing_pages.get('results'))
        except Exception as e:
            print(f"Erreur lors de la vérification: {str(e)}")
            return False