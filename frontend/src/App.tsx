import React, { useState, useEffect } from 'react';
import SearchForm from './components/SearchForm';
import SearchResults from './components/SearchResults';
import config from './config';

interface Business {
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  total_ratings?: number;
  opening_hours?: string[];
}

function App() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSearchParams, setLastSearchParams] = useState<{
    keyword: string;
    city: string;
    radius: string;
  } | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleSearch = async (params: { 
    keyword: string, 
    city: string, 
    radius: number, 
    coordinates?: [number, number] 
  }) => {
    console.log('Starting search with params:', params);
    setLoading(true);
    setError(null);
    setLastSearchParams({
      keyword: params.keyword,
      city: params.city,
      radius: params.radius.toString()
    });

    const searchData = {
      keyword: params.keyword,
      city: params.coordinates 
        ? `${params.city} [${params.coordinates[0].toFixed(6)}, ${params.coordinates[1].toFixed(6)}]`
        : params.city,
      radius: params.radius.toString()
    };

    console.log('Sending search request to:', 'https://api-finder-j9ra-2lezj0n0u-kzacs-projects.vercel.app/search');
    console.log('With data:', searchData);

    try {
      const response = await fetch('https://api-finder-j9ra-2lezj0n0u-kzacs-projects.vercel.app/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchData),
      });

      console.log('Search response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Search error response:', errorText);
        throw new Error(`Erreur lors de la recherche: ${errorText}`);
      }

      const data = await response.json();
      console.log('Search results:', data);
      setResults(data);
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExportGoogleSheets = async (selectedResults: any[]) => {
    if (!lastSearchParams) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${config.apiBaseUrl}/api/export-sheets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyword: lastSearchParams.keyword,
          city: lastSearchParams.city,
          radius: lastSearchParams.radius,
          results: selectedResults
        }),
      });
      const data = await response.json();
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Erreur lors de l\'export Google Sheets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async (selectedResults: any[]) => {
    if (!lastSearchParams) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${config.apiBaseUrl}/api/export-csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyword: lastSearchParams.keyword,
          city: lastSearchParams.city,
          radius: lastSearchParams.radius,
          results: selectedResults
        }),
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de l\'export CSV');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recherche_${lastSearchParams.keyword}_${lastSearchParams.city}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur lors de l\'export CSV:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportNotion = async (selectedResults: any[]) => {
    if (!lastSearchParams) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${config.apiBaseUrl}/api/export-notion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyword: lastSearchParams.keyword,
          city: lastSearchParams.city,
          radius: lastSearchParams.radius,
          results: selectedResults
        }),
      });
      const data = await response.json();
      // Gérer la réponse si nécessaire
    } catch (error) {
      console.error('Erreur lors de l\'export Notion:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
      <header className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg z-[9999] transition-colors duration-300">
        <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center">
            <img 
              src="/static/images/logo.png" 
              alt="Pro Finder Logo" 
              className="h-8 w-8 mr-2"
            />
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent dark:text-white">
              Pro Finder
            </span>
          </div>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300"
            aria-label="Toggle dark mode"
          >
            {darkMode ? (
              <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-24">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 transition-colors duration-300">
          <SearchForm 
            onSearch={handleSearch}
            onExportGoogleSheets={handleExportGoogleSheets}
            onExportCsv={handleExportCsv}
            onExportNotion={handleExportNotion}
            results={results || []}
            isLoading={loading}
          />
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-gray-600 dark:text-gray-400">
            2024 Pro Finder. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
