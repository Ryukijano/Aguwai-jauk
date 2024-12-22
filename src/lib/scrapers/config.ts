export const SCRAPER_CONFIG = {
  sources: [
    {
      name: 'Assam Career Portal',
      url: 'https://assam.gov.in/career',
      selector: '.job-listing'
    },
    {
      name: 'Sarkari Result Assam',
      url: 'https://www.sarkariresult.com/assam/',
      selector: '.result-list'
    }
  ],
  updateInterval: 1000 * 60 * 60 * 6 // 6 hours
};