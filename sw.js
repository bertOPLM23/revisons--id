/* Service worker de rev. : volontairement VIDE. Il ne met rien en cache et n'intercepte aucune requête
   (pas de gestionnaire « fetch ») : l'app se charge toujours depuis le réseau, comme sans lui.
   Il sert seulement à ce qu'iOS traite rev. comme une application web installée (icône sombre). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
