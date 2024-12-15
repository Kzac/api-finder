const config = {
  apiBaseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://api-finder-j9ra-2lezj0n0u-kzacs-projects.vercel.app'
    : 'http://localhost:5001'
};

export default config;
