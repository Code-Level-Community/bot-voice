import { radios } from './config';
import { startRadio } from './radioManager';

console.log('🚀 Inicializando ecossistema de Rádios Virtuais...');

radios.forEach((radio, index) => {
  setTimeout(() => startRadio(radio), index * 20_000);
});