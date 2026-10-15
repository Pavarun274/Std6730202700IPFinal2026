// Default: the course server (backend runs on 119.59.102.161:3064, MySQL on localhost there).
export const API_URL = 'http://119.59.102.161:3064/api';

// Local development: uncomment ONE of these (and comment out the line above) when running
// the backend on your own machine (`cd backend && npm start`, port 3000).
// Android emulator reaches the host via 10.0.2.2; a physical device needs your computer's LAN IP.
// export const API_URL = 'http://localhost:3000/api';
