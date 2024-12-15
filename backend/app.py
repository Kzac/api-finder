from flask import Flask, request, jsonify, redirect, render_template_string, send_file, make_response, send_from_directory
import googlemaps
import requests
import pandas as pd
from datetime import datetime
import os
import time
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from dotenv import load_dotenv
from functools import lru_cache
import io
from flask_cors import CORS
from notion_export import NotionExporter
from notion_client import Client
from constants import KEYWORD_SUGGESTIONS

# Charger les variables d'environnement
load_dotenv()

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3000", "https://*.vercel.app", "https://api-finder.vercel.app"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Configuration des APIs
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')

# Configuration Google Sheets
SCOPES = ['https://spreadsheets.google.com/feeds',
          'https://www.googleapis.com/auth/drive']
CREDENTIALS_FILE = 'credentials.json'

# Configuration Notion
NOTION_TOKEN = os.getenv('NOTION_TOKEN')
NOTION_DATABASE_ID = os.getenv('NOTION_DATABASE_ID')

# Initialiser le client Google Maps
try:
    if not GOOGLE_MAPS_API_KEY:
        raise ValueError("La clé API Google Maps n'est pas définie")
    gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)
    # Tester la connexion
    gmaps.geocode("Paris")  # Test simple
    print("✓ Client Google Maps initialisé avec succès")
except Exception as e:
    print(f"❌ Erreur d'initialisation Google Maps: {str(e)}")
    raise

def perform_search(keyword, city, radius):
    try:
        print(f"Recherche pour: keyword='{keyword}', city='{city}', radius='{radius}km'")
        
        # Extraire les coordonnées si elles sont présentes dans la chaîne city
        location_coords = None
        if '[' in city and ']' in city:
            try:
                coords_str = city[city.index('[') + 1:city.index(']')]
                lat, lng = map(float, coords_str.split(','))
                location_coords = {'lat': lat, 'lng': lng}
                city = city[:city.index('[')].strip()
            except Exception as e:
                print(f"Erreur lors de l'extraction des coordonnées: {str(e)}")

        # Si pas de coordonnées, faire le géocodage
        if not location_coords:
            try:
                geocode_result = gmaps.geocode(city)
                if not geocode_result:
                    return []
                location_coords = geocode_result[0]['geometry']['location']
            except Exception as e:
                print(f"Erreur lors du géocodage: {str(e)}")
                return []

        # Liste pour stocker tous les résultats
        all_results = []
        
        # Premier appel à l'API
        places_result = gmaps.places_nearby(
            location=location_coords,
            radius=int(radius) * 1000,  # conversion en mètres
            keyword=keyword
        )
        
        if 'results' in places_result:
            all_results.extend(places_result['results'])
            
            # Récupérer les pages suivantes s'il y en a
            while 'next_page_token' in places_result:
                time.sleep(2)  # Attendre que le token soit valide
                places_result = gmaps.places_nearby(
                    location=location_coords,
                    radius=int(radius) * 1000,
                    keyword=keyword,
                    page_token=places_result['next_page_token']
                )
                if places_result.get('results'):
                    all_results.extend(places_result['results'])

        entreprises = []
        for place in all_results:
            try:
                details = gmaps.place(place['place_id'], fields=[
                    'name',
                    'formatted_address',
                    'formatted_phone_number',
                    'website',
                    'rating',
                    'user_ratings_total',
                    'opening_hours',
                    'business_status'
                ])['result']
                
                entreprise = {
                    'id': str(place['place_id']),
                    'name': details.get('name', ''),
                    'address': details.get('formatted_address', ''),
                    'phone': details.get('formatted_phone_number', ''),
                    'website': details.get('website', ''),
                    'rating': details.get('rating', 'N/A'),
                    'total_ratings': details.get('user_ratings_total', '0'),
                    'opening_hours': details.get('opening_hours', {}).get('weekday_text', []),
                    'business_status': details.get('business_status', '')
                }

                # Vérifier si l'entreprise existe dans Notion
                try:
                    if NOTION_TOKEN and NOTION_DATABASE_ID:
                        exporter = NotionExporter(NOTION_TOKEN, NOTION_DATABASE_ID)
                        existing_pages = exporter.notion.databases.query(
                            database_id=NOTION_DATABASE_ID,
                            filter={
                                "property": "Name",
                                "title": {
                                    "equals": entreprise['name']
                                }
                            }
                        )
                        entreprise['alreadyExported'] = bool(existing_pages.get('results'))
                except Exception as e:
                    print(f"Erreur lors de la vérification Notion: {str(e)}")
                    entreprise['alreadyExported'] = False
                
                entreprises.append(entreprise)
            except Exception as e:
                print(f"Error processing place: {str(e)}")
                continue

        return entreprises

    except Exception as e:
        print(f"Erreur détaillée dans perform_search: {str(e)}")
        print(f"Paramètres reçus: keyword='{keyword}', city='{city}', radius='{radius}'")
        return []

@app.route('/suggestions')
def get_suggestions():
    return jsonify(KEYWORD_SUGGESTIONS)

@app.route('/api/recherche-google')
def recherche_google():
    try:
        # Get and validate parameters
        keyword = request.args.get('keyword', '')
        city = request.args.get('city', '')
        radius_km = request.args.get('radius', 5)
        
        print(f"Recherche demandée - Mot-clé: {keyword}, Ville: {city}, Rayon: {radius_km}km")
        
        if not keyword or not city:
            return jsonify({"error": "Keyword and city are required"}), 400
            
        try:
            radius = int(float(radius_km)) * 1000  # conversion en mètres
        except ValueError:
            return jsonify({"error": "Radius must be a number"}), 400

        # Géocodage
        try:
            print(f"🔍 Début du géocodage pour: {city}")
            # Essayons avec le pays spécifié
            city_with_country = f"{city}, Belgium"
            print(f"🌍 Tentative avec ville + pays: {city_with_country}")
            
            geocode_result = gmaps.geocode(city_with_country)
            print(f"📍 Résultat brut du géocodage: {geocode_result}")
            
            if not geocode_result:
                print("❌ Aucun résultat trouvé pour cette localisation")
                return jsonify({"error": f"Localisation '{city_with_country}' non trouvée"}), 400
                
            location_coords = geocode_result[0]['geometry']['location']
            print(f"✓ Coordonnées trouvées: {location_coords}")
            
            # Ajout des coordonnées manuelles de Musson si le géocodage échoue
            if not location_coords and city.lower() == "musson":
                print("ℹ️ Utilisation des coordonnées manuelles pour Musson")
                location_coords = {'lat': 49.5667, 'lng': 5.5333}
            
        except Exception as e:
            print(f"❌ Erreur détaillée de géocodage: {str(e)}")
            print(f"Type d'erreur: {type(e).__name__}")
            return jsonify({"error": f"Erreur lors du géocodage: {str(e)}"}), 400

        # Liste pour stocker tous les résultats
        all_results = []
        
        # Premier appel à l'API
        try:
            places_result = gmaps.places_nearby(
                location=location_coords,
                radius=radius,
                keyword=keyword
            )
            
            if 'results' in places_result:
                all_results.extend(places_result['results'])
        except Exception as e:
            print(f"Places API error: {str(e)}")
            return jsonify({"error": "Error during places API call"}), 400

        entreprises = []
        for idx, place in enumerate(all_results):
            try:
                details = gmaps.place(place['place_id'], fields=[
                    'name',
                    'formatted_address',
                    'formatted_phone_number',
                    'website',
                    'type',
                    'rating',
                    'user_ratings_total',
                    'opening_hours',
                    'business_status',
                    'price_level'
                ])['result']
                
                entreprise = {
                    'id': str(place['place_id']),  # Utiliser place_id comme ID unique
                    'name': details.get('name', ''),
                    'address': details.get('formatted_address', ''),
                    'phone': details.get('formatted_phone_number', ''),
                    'website': details.get('website', ''),
                    'rating': details.get('rating', 'N/A'),
                    'total_ratings': details.get('user_ratings_total', '0'),
                    'opening_hours': details.get('opening_hours', {}).get('weekday_text', []),
                    'business_status': details.get('business_status', '')
                }
                
                # Vérifier si l'entreprise existe dans Notion
                try:
                    exporter = NotionExporter(NOTION_TOKEN, NOTION_DATABASE_ID)
                    existing_pages = exporter.notion.databases.query(
                        database_id=NOTION_DATABASE_ID,
                        filter={
                            "property": "Name",
                            "title": {
                                "equals": entreprise['name']
                            }
                        }
                    )
                    entreprise['alreadyExported'] = bool(existing_pages.get('results'))
                except Exception as e:
                    print(f"Erreur lors de la vérification Notion: {str(e)}")
                    entreprise['alreadyExported'] = False
                
                entreprises.append(entreprise)
            except Exception as e:
                print(f"Error processing place: {str(e)}")
                continue

        return jsonify(entreprises)

    except Exception as e:
        print(f"Erreur: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/export-csv', methods=['POST'])
def export_to_csv():
    try:
        data = request.get_json()
        keyword = data.get('keyword', '')
        selected_results = data.get('results', [])

        if not selected_results:
            return jsonify({"error": "Aucun résultat sélectionné"}), 400

        # Créer un DataFrame pandas avec les résultats sélectionnés
        df = pd.DataFrame(selected_results)
        
        # Réorganiser et renommer les colonnes pour plus de clarté
        columns_mapping = {
            'name': 'Nom',
            'address': 'Adresse',
            'phone': 'Téléphone',
            'website': 'Site Web',
            'rating': 'Note Google',
            'total_ratings': 'Nombre d\'avis',
            'business_status': 'Statut'
        }
        
        # Ajouter le mot-clé pour chaque résultat
        df['keyword'] = keyword
        columns_mapping['keyword'] = 'Mot-clé recherché'
        
        df = df.rename(columns=columns_mapping)
        df = df[columns_mapping.values()]  # Réorganiser les colonnes

        # Créer le fichier CSV en mémoire
        output = io.StringIO()
        df.to_csv(output, index=False, encoding='utf-8-sig')
        
        # Créer la réponse avec le bon type MIME
        response = make_response(output.getvalue())
        response.headers["Content-Disposition"] = f"attachment; filename=recherche_{keyword}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response.headers["Content-type"] = "text/csv; charset=utf-8-sig"
        
        return response

    except Exception as e:
        print(f"Erreur lors de l'export CSV: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/export-notion', methods=['POST'])
def export_to_notion():
    try:
        data = request.get_json()
        keyword = data.get('keyword', '')
        selected_results = data.get('results', [])

        if not selected_results:
            return jsonify({"error": "Aucun résultat sélectionné"}), 400

        if not NOTION_TOKEN or not NOTION_DATABASE_ID:
            return jsonify({"error": "Configuration Notion manquante"}), 500

        notion = NotionExporter(NOTION_TOKEN, NOTION_DATABASE_ID)
        
        # Ajouter le mot-clé à chaque résultat avant l'export
        exported_count = 0
        for result in selected_results:
            try:
                # Ajouter le mot-clé au résultat
                result['keyword'] = keyword
                notion.export_business(result)
                exported_count += 1
            except Exception as e:
                print(f"Erreur lors de l'export vers Notion pour {result.get('name')}: {str(e)}")
                continue

        return jsonify({
            "success": True, 
            "message": f"{exported_count} entreprise(s) exportée(s) vers Notion"
        })

    except Exception as e:
        print(f"Erreur lors de l'export Notion: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/export-sheets', methods=['POST'])
def export_to_sheets():
    try:
        data = request.get_json()
        keyword = data.get('keyword', '')
        city = data.get('city', '')
        radius = data.get('radius', '5')
        selected_results = data.get('results', [])

        if not selected_results:
            return jsonify({"error": "Aucun résultat sélectionné"}), 400

        # Ajouter le mot-clé à chaque résultat
        for result in selected_results:
            result['keyword'] = keyword

        # Exporter vers Google Sheets
        sheet_url = export_to_gsheet(selected_results, f"Recherche {keyword} - {city}")
        return jsonify({"success": True, "url": sheet_url})

    except Exception as e:
        print(f"Erreur lors de l'export Google Sheets: {str(e)}")
        return jsonify({"error": str(e)}), 500

def export_to_gsheet(data, source):
    try:
        creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, SCOPES)
        client = gspread.authorize(creds)
        
        sheet_name = f'Prospection_{source}_{datetime.now().strftime("%d-%m-%Y")}'
        spreadsheet = client.create(sheet_name)
        worksheet = spreadsheet.sheet1
        
        # Renommer la première feuille
        worksheet.update_title('Liste Prospects')
        
        # Définir les en-têtes
        headers = [
            'ID',
            'Nom Entreprise',
            'Adresse Complète',
            'Téléphone',
            'Site Web',
            'Type d\'établissement',
            'Note Google',
            'Nombre d\'avis',
            'Horaires d\'ouverture',
            'Email (à compléter)',
            'Statut Contact',
            'Notes/Commentaires'
        ]
        
        worksheet.append_row(headers)
        
        # Formater les en-têtes
        worksheet.format('A1:L1', {
            "backgroundColor": {"red": 0.2, "green": 0.2, "blue": 0.2},
            "textFormat": {"foregroundColor": {"red": 1, "green": 1, "blue": 1}, "bold": True},
            "horizontalAlignment": "CENTER"
        })
        
        # Ajouter les données
        for item in data:
            row = [str(value) for value in item.values()]
            worksheet.append_row(row)
        
        # Formater le contenu
        if len(data) > 0:
            worksheet.format(f'A2:L{len(data)+1}', {
                "backgroundColor": {"red": 1, "green": 1, "blue": 1},
                "textFormat": {"foregroundColor": {"red": 0, "green": 0, "blue": 0}},
                "verticalAlignment": "MIDDLE",
                "wrapStrategy": "WRAP"
            })
        
        # Ajustements finaux
        worksheet.freeze(rows=1)
        worksheet.set_basic_filter()
        worksheet.columns_auto_resize(0, len(headers)-1)
        
        # Partager le spreadsheet
        spreadsheet.share(None, perm_type='anyone', role='reader')
        
        return spreadsheet.url
        
    except Exception as e:
        print(f"Erreur lors de l'export: {str(e)}")
        return None

@app.route('/api/test-notion')
def test_notion():
    try:
        print(f"Test de connexion Notion avec token: {NOTION_TOKEN[:10]}...")
        print(f"Test avec database ID: {NOTION_DATABASE_ID}")
        
        notion = Client(auth=NOTION_TOKEN)
        database = notion.databases.retrieve(database_id=NOTION_DATABASE_ID)
        
        return jsonify({
            "success": True,
            "database_info": {
                "title": database.get("title", [{}])[0].get("text", {}).get("content", ""),
                "id": database.get("id", ""),
                "properties": list(database.get("properties", {}).keys())
            }
        })
    except Exception as e:
        print(f"Erreur lors du test Notion: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/search', methods=['POST', 'OPTIONS'])
def search():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response

    try:
        data = request.get_json()
        keyword = data.get('keyword', '')
        city = data.get('city', '')
        radius = data.get('radius', 5)
        
        if not keyword or not city:
            return jsonify({"error": "Keyword and city are required"}), 400
            
        results = perform_search(keyword, city, radius)
        return jsonify(results)
        
    except Exception as e:
        print(f"Error in search: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Route par défaut qui renvoie un message d'API
@app.route('/')
def home():
    return jsonify({
        "status": "ok",
        "message": "API Pro Finder en cours d'exécution",
        "version": "1.0.0"
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)