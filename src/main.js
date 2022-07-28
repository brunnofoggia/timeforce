import _ from 'lodash';
import timeforce from './global.js';
import { extend } from './helpers.js';
import { Events } from './events.js';
import Deep from './deep.js';
import Model from './model.js';
import Collection from './collection.js';
import Sync from './sync.js';
import { mix as mixLodash } from './lodash.proxy.js';

// Initial Setup
// -------------

// global variable for extension
timeforce._global = timeforce;

// Allow the `timeforce` object to serve as a global event bus, for folks who
// want global "pubsub" in a convenient place.
timeforce.Events = Events;
_.extend(timeforce, Events);

// Attach Deep to the `timeforce` object
timeforce.Deep = Deep;


// timeforce.Model
// --------------

// Attach Model to the `timeforce` object
timeforce.Model = Model;


// timeforce.Collection
// -------------------

// The default model for a collection is just a **timeforce.Model**.
// This should be overridden in most cases.
Collection.prototype.model = Model;

// Attach Collection to the `timeforce` object
timeforce.Collection = Collection;


// Proxy timeforce class methods to Lodash functions
// --------------

// Mix in each Lodash method as a proxy to `Collection#models`.
mixLodash(Collection, Model);


// timeforce.Sync
// --------------

// Attach Sync functionalitty to the `timeforce` object
_.extend(timeforce, Sync);
timeforce.sync = function () { return _.partial(Sync.sync, this._global).apply(this, arguments); };


// Set up inheritance for the model, collection, router, view and history.
Model.extend = Collection.extend = extend;

export { extend, Events, Deep, timeforce };
export default timeforce;