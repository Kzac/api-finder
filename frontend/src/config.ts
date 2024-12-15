const config = {
  apiBaseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://api-finder.vercel.app/api'
    : 'http://localhost:5001'
};

export default config;
