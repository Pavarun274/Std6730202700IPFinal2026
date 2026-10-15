import { Platform } from 'react-native';

// Android emulator reaches the host machine via 10.0.2.2.
// On a physical device, replace with your computer's LAN IP, e.g. 'http://192.168.1.10:3000'.
const HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
export const API_URL = `http://${HOST}:3000/api`;
