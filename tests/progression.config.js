import config from './playwright.config.js';
export default {...config,workers:2,use:{...config.use,serviceWorkers:'block',baseURL:'http://localhost:3000'},webServer:{command:'npm run dev',cwd:'../',url:'http://localhost:3000',reuseExistingServer:true,timeout:60000}};
