const EventEmitter = require('events');
// One emitter per store: eventBus.emit(`store:${storeId}`, notificationPayload)
const eventBus = new EventEmitter();
eventBus.setMaxListeners(100); // allow many SSE subscribers
module.exports = eventBus;
