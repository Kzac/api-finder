import React, { useState, useEffect, useRef } from 'react';
import { KEYWORD_SUGGESTIONS } from '../constants/suggestions';
import MapRadius from './MapRadius';
import Toast from './Toast';

declare global {
  interface Window {
    google: typeof google;
  }
}

interface SearchFormProps {
  onSearch: (params: { keyword: string, city: string, radius: number, coordinates?: [number, number] }) => void;
  onExportGoogleSheets: (selectedResults: any[]) => void;
  onExportCsv: (selectedResults: any[]) => void;
  onExportNotion: (selectedResults: any[]) => void;
  results: any[];
  isLoading: boolean;
}

export const SearchForm: React.FC<SearchFormProps> = ({
  onSearch,
  onExportGoogleSheets,
  onExportCsv,
  onExportNotion,
  results,
  isLoading
}) => {
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState('');
  const [radius, setRadius] = useState('5');
  const [coordinates, setCoordinates] = useState<[number, number] | undefined>(undefined);
  const [showCircle, setShowCircle] = useState(false);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });

  const autoCompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const cityInputRef = useRef<HTMLInputElement>(null);

  const formatAddress = (result: google.maps.GeocoderResult | google.maps.places.PlaceResult): string => {
    let city = '';
    let country = '';

    result.address_components?.forEach((component) => {
      if (component.types.includes('locality')) {
        city = component.long_name;
      }
      if (component.types.includes('country')) {
        country = component.long_name;
      }
    });

    return city && country ? `${city}, ${country}` : result.formatted_address || '';
  };

  useEffect(() => {
    const initAutocomplete = () => {
      if (!cityInputRef.current || !window.google) return;

      autoCompleteRef.current = new window.google.maps.places.Autocomplete(
        cityInputRef.current,
        {
          types: ['(cities)'],
          componentRestrictions: { country: 'FR' },
          fields: ['formatted_address', 'geometry', 'name', 'address_components']
        }
      );

      // Désactiver complètement l'autocomplétion du navigateur
      cityInputRef.current.setAttribute('autocomplete', 'off');
      cityInputRef.current.setAttribute('spellcheck', 'false');
      cityInputRef.current.setAttribute('role', 'presentation');

      // Empêcher Google Places de modifier la valeur de l'input
      const pac = document.querySelector('.pac-container');
      if (pac) {
        pac.addEventListener('click', (e) => e.stopPropagation());
      }

      autoCompleteRef.current.addListener('place_changed', () => {
        const place = autoCompleteRef.current?.getPlace();
        if (place?.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          setCity(formatAddress(place));
          setCoordinates([lat, lng]);
          setShowCircle(true); // Afficher le cercle quand une ville est sélectionnée
          
          // Déclencher handleLocationChange pour mettre à jour la carte
          handleLocationChange(lat, lng);
        }
      });
    };

    initAutocomplete();
    return () => {
      if (autoCompleteRef.current) {
        google.maps.event.clearInstanceListeners(autoCompleteRef.current);
      }
    };
  }, []);

  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCity(e.target.value);
    if (!e.target.value) {
      setShowCircle(false); // Cacher le cercle si le champ est vidé
    }
  };

  const handleLocationChange = (lat: number, lng: number) => {
    setCoordinates([lat, lng]);
    setShowCircle(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting search with:', { keyword, city, radius, coordinates });
    onSearch({
      keyword,
      city,
      radius: parseInt(radius),
      coordinates: coordinates || undefined
    });
  };

  const handleSelectAll = () => {
    if (selectedResults.size === results.length) {
      setSelectedResults(new Set());
    } else {
      setSelectedResults(new Set(results.map(r => r.id)));
    }
  };

  const handleSelectResult = (id: string) => {
    const newSelected = new Set(selectedResults);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedResults(newSelected);
    console.log('Selected results:', Array.from(newSelected));  // Pour le débogage
  };

  const renderResults = () => (
    <div className="mt-4 space-y-4">
      {results.map((result) => (
        <div 
          key={result.id} 
          className="flex items-center p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          onClick={(e) => {
            // Éviter le déclenchement si on clique sur la case à cocher
            if (!(e.target as HTMLElement).closest('input[type="checkbox"]')) {
              handleSelectResult(result.id);
            }
          }}
        >
          <input
            type="checkbox"
            checked={selectedResults.has(result.id)}
            onChange={(e) => {
              e.stopPropagation();  // Empêcher la propagation au div parent
              handleSelectResult(result.id);
            }}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600"
          />
          <div className="ml-4 flex-grow">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">{result.name}</h4>
              {result.alreadyExported && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-300">
                  Déjà dans Notion
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-300">{result.address}</p>
            {result.phone && (
              <p className="text-sm text-gray-500 dark:text-gray-300">{result.phone}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
  };

  const closeToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };

  const handleExportGoogleSheets = async () => {
    try {
      const selected = results.filter(r => selectedResults.has(r.id));
      await onExportGoogleSheets(selected);
      showToast('Export vers Google Sheets réussi !', 'success');
    } catch (error) {
      showToast('Erreur lors de l\'export vers Google Sheets', 'error');
    }
  };

  const handleExportCsv = async () => {
    try {
      const selected = results.filter(r => selectedResults.has(r.id));
      await onExportCsv(selected);
      showToast('Export CSV réussi !', 'success');
    } catch (error) {
      showToast('Erreur lors de l\'export CSV', 'error');
    }
  };

  const handleExportNotion = async () => {
    try {
      const selected = results.filter(r => selectedResults.has(r.id));
      await onExportNotion(selected);
      showToast('Export vers Notion réussi !', 'success');
    } catch (error) {
      showToast('Erreur lors de l\'export vers Notion', 'error');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Recherche d'entreprises</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Cliquez sur la carte pour définir le centre de recherche</p>
      
      <form onSubmit={handleSubmit} autoComplete="off">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Mot-clé
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white p-3 text-lg"
              placeholder="Ex: restaurant, boulangerie..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Ville
            </label>
            <input
              ref={cityInputRef}
              type="text"
              value={city}
              onChange={handleCityChange}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white p-3 text-lg"
              placeholder="Entrez une ville en France..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Rayon (km)
            </label>
            <input
              type="number"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              min="1"
              max="50"
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white p-3 text-lg"
            />
          </div>
        </div>

        <div className="col-span-1 md:col-span-3 mt-4">
          <MapRadius 
            city={city} 
            radius={parseInt(radius) || 5} 
            onLocationChange={handleLocationChange}
            showCircle={showCircle}
          />
        </div>

        <div className="flex space-x-4 mt-6">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors duration-200"
          >
            Rechercher
          </button>
        </div>
      </form>

      {results.length > 0 && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200">
              Résultats ({results.length})
            </h3>
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                {selectedResults.size === results.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={handleExportGoogleSheets}
                  disabled={selectedResults.size === 0}
                  className={`bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md transition-colors duration-200 ${
                    selectedResults.size === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Exporter vers Google Sheets
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={selectedResults.size === 0}
                  className={`bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-4 rounded-md transition-colors duration-200 ${
                    selectedResults.size === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Télécharger CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportNotion}
                  disabled={selectedResults.size === 0}
                  className={`bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-md transition-colors duration-200 ${
                    selectedResults.size === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Exporter vers Notion
                </button>
              </div>
            </div>
          </div>
          {renderResults()}
        </div>
      )}

      {/* Suggestions */}
      {!results.length && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200 mb-4">
            Suggestions par catégorie
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(KEYWORD_SUGGESTIONS).map(([category, keywords]: [string, string[]]) => (
              <div key={category} className="relative group">
                <button
                  type="button"
                  className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {category}
                </button>
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200">
                  {keywords.map((kw: string) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => setKeyword(kw)}
                      className="block w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={closeToast}
      />
    </div>
  );
};

export default SearchForm;