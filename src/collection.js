import _ from 'lodash';
import timeforce from './global.js';
import { slice, wrapError } from './helpers.js';
import { Events } from './events.js';

// timeforce.Collection
// -------------------

// If models tend to represent a single row of data, a timeforce Collection is
// more analogous to a table full of data ... or a small slice or page of that
// table, or a collection of rows that belong together for a particular reason
// -- all of the messages in this particular folder, all of the documents
// belonging to this particular author, and so on. Collections maintain
// indexes of their models, both in order, and for lookup by `id`.

// Create a new **Collection**, perhaps to contain a specific type of `model`.
// If a `comparator` is specified, the Collection will maintain
// its models in sort order, as they're added and removed.
var Collection = function (models, options) {
    options || (options = {});
    this.setMethodsOnPrototype.apply(this);
    this.instanceForm.apply(this);
    this.preinitialize.apply(this, arguments);
    _.each(this.preinitializePluginMethods, (name) => this[name].apply(this, arguments));
    this.cid = _.uniqueId(this.cidPrefix);
    if (options.model) this.model = options.model;
    if (options.comparator !== void 0) this.comparator = options.comparator;
    this._reset();
    _.each(this.initializePluginMethods, (name) => this[name].apply(this, arguments));
    this.initialize.apply(this, arguments);
    if (models) this.reset(models, _.extend({ silent: true }, options));
};

// Default options for `Collection#set`.
var setOptions = { add: true, remove: true, merge: true };
var addOptions = { add: true, remove: false };

// Splices `insert` into `array` at index `at`.
var splice = function (array, insert, at) {
    at = Math.min(Math.max(at, 0), array.length);
    var tail = Array(array.length - at);
    var length = insert.length;
    var i;
    for (i = 0; i < tail.length; i++) tail[i] = array[i + at];
    for (i = 0; i < length; i++) array[i + at] = insert[i];
    for (i = 0; i < tail.length; i++) array[i + length + at] = tail[i];
};

// Define the Collection's inheritable methods.
_.extend(Collection.prototype, Events, timeforce.globalPrototype, {
    // global
    _global: timeforce,

    // The prefix is used to create the client id which is used to identify models locally.
    // You may want to override this if you're experiencing name clashes with model ids.
    cidPrefix: 'c',

    // preinitialize is an empty function by default. You can override it with a function
    // or object.  preinitialize will run before any instantiation logic is run in the Collection.
    preinitialize: function () { },

    // preinitialize plugin methods is a list of method names that will run after preinitialize method is run in the Model.
    preinitializePluginMethods: [],

    // initialize plugin methods is a list of method names that will run before the initialize method is run in the Model.
    initializePluginMethods: [],

    // defines if filters should be send with POST method
    sendFormAsPost: false,

    // defines the field that will hold the array of results to be converted into models
    responseResultsField: 'data',

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function () { },

    // The JSON representation of a Collection is an array of the
    // models' attributes.
    toJSON: function (options) {
        return this.map(function (model) { return model.toJSON(options); });
    },

    // Proxy `timeforce.sync` by default -- but override this if you need
    // custom syncing semantics for *this* particular model.
    sync: function () {
        return this._global.sync.apply(this, arguments);
    },

    // Add a model, or list of models to the set. `models` may be timeforce
    // Models or raw JavaScript objects to be converted to Models, or any
    // combination of the two.
    add: function (models, options) {
        return this.set(models, _.extend({ merge: false }, options, addOptions));
    },

    // Remove a model, or a list of models from the set.
    remove: function (models, options) {
        options = _.extend({}, options);
        var singular = !_.isArray(models);
        models = singular ? [models] : models.slice();
        var removed = this._removeModels(models, options);
        if (!options.silent && removed.length) {
            options.changes = { added: [], merged: [], removed: removed };
            this.trigger('update', this, options);
        }
        return singular ? removed[0] : removed;
    },

    // Update a collection by `set`-ing a new list of models, adding new ones,
    // removing models that are no longer present, and merging models that
    // already exist in the collection, as necessary. Similar to **Model#set**,
    // the core operation for updating the data contained by the collection.
    set: function (models, options) {
        if (models == null) return;

        options = _.extend({}, setOptions, options);
        if (options.parse && !this._isModel(models)) {
            models = this.parse(models, options) || [];
        }

        var singular = !_.isArray(models);
        models = singular ? [models] : models.slice();

        var at = options.at;
        if (at != null) at = +at;
        if (at > this.length) at = this.length;
        if (at < 0) at += this.length + 1;

        var set = [];
        var toAdd = [];
        var toMerge = [];
        var toRemove = [];
        var modelMap = {};

        var add = options.add;
        var merge = options.merge;
        var remove = options.remove;

        var sort = false;
        var sortable = this.comparator && at == null && options.sort !== false;
        var sortAttr = _.isString(this.comparator) ? this.comparator : null;

        // Turn bare objects into model references, and prevent invalid models
        // from being added.
        var model, i;
        for (i = 0; i < models.length; i++) {
            model = models[i];

            // If a duplicate is found, prevent it from being added and
            // optionally merge it into the existing model.
            var existing = this.get(model);
            if (existing) {
                if (merge && model !== existing) {
                    var attrs = this._isModel(model) ? model.attributes : model;
                    if (options.parse) attrs = existing.parse(attrs, options);
                    existing.set(attrs, options);
                    toMerge.push(existing);
                    if (sortable && !sort) sort = existing.hasChanged(sortAttr);
                }
                if (!modelMap[existing.cid]) {
                    modelMap[existing.cid] = true;
                    set.push(existing);
                }
                models[i] = existing;

                // If this is a new, valid model, push it to the `toAdd` list.
            } else if (add) {
                model = models[i] = this._prepareModel(model, options);
                if (model) {
                    toAdd.push(model);
                    this._addReference(model, options);
                    modelMap[model.cid] = true;
                    set.push(model);
                }
            }
        }

        // Remove stale models.
        if (remove) {
            for (i = 0; i < this.length; i++) {
                model = this.models[i];
                if (!modelMap[model.cid]) toRemove.push(model);
            }
            if (toRemove.length) this._removeModels(toRemove, options);
        }

        // See if sorting is needed, update `length` and splice in new models.
        var orderChanged = false;
        var replace = !sortable && add && remove;
        if (set.length && replace) {
            orderChanged = this.length !== set.length || _.some(this.models, function (m, index) {
                return m !== set[index];
            });
            this.models.length = 0;
            splice(this.models, set, 0);
            this.length = this.models.length;
        } else if (toAdd.length) {
            if (sortable) sort = true;
            splice(this.models, toAdd, at == null ? this.length : at);
            this.length = this.models.length;
        }

        // Silently sort the collection if appropriate.
        if (sort) this.sort({ silent: true });

        // Unless silenced, it's time to fire all appropriate add/sort/update events.
        if (!options.silent) {
            for (i = 0; i < toAdd.length; i++) {
                if (at != null) options.index = at + i;
                model = toAdd[i];
                model.trigger('add', model, this, options);
            }
            if (sort || orderChanged) this.trigger('sort', this, options);
            if (toAdd.length || toRemove.length || toMerge.length) {
                options.changes = {
                    added: toAdd,
                    removed: toRemove,
                    merged: toMerge
                };
                this.trigger('update', this, options);
            }
        }

        // Return the added (or merged) model (or models).
        return singular ? models[0] : models;
    },

    // When you have more items than you want to add or remove individually,
    // you can reset the entire set with a new list of models, without firing
    // any granular `add` or `remove` events. Fires `reset` when finished.
    // Useful for bulk operations and optimizations.
    reset: function (models, options) {
        options = options ? _.clone(options) : {};
        for (var i = 0; i < this.models.length; i++) {
            this._removeReference(this.models[i], options);
        }
        options.previousModels = this.models;
        this._reset();
        models = this.add(models, _.extend({ silent: true }, options));
        if (!options.silent) this.trigger('reset', this, options);
        return models;
    },

    // Add a model to the end of the collection.
    push: function (model, options) {
        return this.add(model, _.extend({ at: this.length }, options));
    },

    // Remove a model from the end of the collection.
    pop: function (options) {
        var model = this.at(this.length - 1);
        return this.remove(model, options);
    },

    // Add a model to the beginning of the collection.
    unshift: function (model, options) {
        return this.add(model, _.extend({ at: 0 }, options));
    },

    // Remove a model from the beginning of the collection.
    shift: function (options) {
        var model = this.at(0);
        return this.remove(model, options);
    },

    // Slice out a sub-array of models from the collection.
    slice: function () {
        return slice.apply(this.models, arguments);
    },

    // Get a model from the set by id, cid, model object with id or cid
    // properties, or an attributes object that is transformed through modelId.
    get: function (obj) {
        if (obj == null) return void 0;
        return this._byId[obj] ||
            this._byId[this.modelId(this._isModel(obj) ? obj.attributes : obj, obj.idAttribute)] ||
            obj.cid && this._byId[obj.cid];
    },

    // Returns `true` if the model is in the collection.
    has: function (obj) {
        return this.get(obj) != null;
    },

    // Get the model at the given index.
    at: function (index) {
        if (index < 0) index += this.length;
        return this.models[index];
    },

    // Return models with matching attributes. Useful for simple cases of
    // `filter`.
    where: function (attrs, first) {
        return this[first ? 'find' : 'filter'](attrs);
    },

    // Return the first model with matching attributes. Useful for simple cases
    // of `find`.
    findWhere: function (attrs) {
        return this.where(attrs, true);
    },

    // Force the collection to re-sort itself. You don't need to call this under
    // normal circumstances, as the set will maintain sort order as each item
    // is added.
    sort: function (options) {
        var comparator = this.comparator;
        if (!comparator) throw new Error('Cannot sort a set without a comparator');
        options || (options = {});

        var length = comparator.length;
        if (_.isFunction(comparator)) comparator = comparator.bind(this);

        // Run sort based on type of `comparator`.
        if (length === 1 || _.isString(comparator)) {
            this.models = this.sortBy(comparator);
        } else {
            this.models.sort(comparator);
        }
        if (!options.silent) this.trigger('sort', this, options);
        return this;
    },

    // Pluck an attribute from each model in the collection.
    pluck: function (attr) {
        return this.map(attr + '');
    },

    // Fetch the default set of models for this collection, resetting the
    // collection when they arrive. If `reset: true` is passed, the response
    // data will be passed through the `reset` method instead of `set`.
    fetch: function (options) {
        options = _.extend({ parse: true, caller: 'fetch' }, options);
        var success = options.success;
        var collection = this;
        var method = 'read';
        options.success = function (resp) {
            var isObject = !(!resp || _.isArray(resp));
            var data = (!isObject ? resp : resp[collection.responseResultsField]);
            var method = options.reset ? 'reset' : 'set';

            collection[method](data, options);
            isObject && collection.setForm(_.omit(resp, collection.responseResultsField));

            if (success) success.call(options.context, collection, resp, options);
            collection.trigger('fetch', collection, resp, options);
            collection.trigger('sync', collection, resp, options);
        };
        wrapError(this, options, 'fetch');

        // Makes possible to fetch lists with filters, pagination and more using POST
        if (this.form && _.result(this, 'sendFormAsPost')) method = 'create';

        return this.sync(method, this, options);
    },

    // Create a new instance of a model in this collection. Add the model to the
    // collection immediately, unless `wait: true` is passed, in which case we
    // wait for the server to agree.
    create: function (model, options) {
        options = options ? _.clone(options) : {};
        var wait = options.wait;
        model = this._prepareModel(model, options);
        if (!model) return false;
        if (!wait) this.add(model, options);
        var collection = this;
        var success = options.success;
        options.success = function (m, resp, callbackOpts) {
            if (wait) collection.add(m, callbackOpts);
            if (success) success.call(callbackOpts.context, m, resp, callbackOpts);
        };
        model.save(null, options);
        return model;
    },

    // **parse** converts a response into a list of models to be added to the
    // collection. The default implementation is just to pass it through.
    parse: function (resp) {
        return resp;
    },

    // Create a new collection with an identical list of models as this one.
    clone: function () {
        return new this.constructor(this.models, {
            model: this.model,
            comparator: this.comparator
        });
    },

    // Define how to uniquely identify models in the collection.
    modelId: function (attrs, idAttribute) {
        return attrs[idAttribute || this.model.prototype.idAttribute || 'id'];
    },

    // Get an iterator of all models in this collection.
    values: function () {
        return new CollectionIterator(this, ITERATOR_VALUES);
    },

    // Get an iterator of all model IDs in this collection.
    keys: function () {
        return new CollectionIterator(this, ITERATOR_KEYS);
    },

    // Get an iterator of all [ID, model] tuples in this collection.
    entries: function () {
        return new CollectionIterator(this, ITERATOR_KEYSVALUES);
    },

    // Private method to reset all internal state. Called when the collection
    // is first initialized or reset.
    _reset: function () {
        this.length = 0;
        this.models = [];
        this._byId = {};
    },

    // Prepare a hash of attributes (or other model) to be added to this
    // collection.
    _prepareModel: function (attrs, options) {
        if (this._isModel(attrs)) {
            if (!attrs.collection) attrs.collection = this;
            return attrs;
        }
        options = options ? _.clone(options) : {};
        options.collection = this;

        var model;
        if (this.model.prototype) {
            model = new this.model(attrs, options);
        } else {
            // ES class methods didn't have prototype
            model = this.model(attrs, options);
        }

        if (!model.validationError) return model;
        this.trigger('invalid', this, model.validationError, options);
        return false;
    },

    // Internal method called by both remove and set.
    _removeModels: function (models, options) {
        var removed = [];
        for (var i = 0; i < models.length; i++) {
            var model = this.get(models[i]);
            if (!model) continue;

            var index = this.indexOf(model);
            this.models.splice(index, 1);
            this.length--;

            // Remove references before triggering 'remove' event to prevent an
            // infinite loop. #3693
            delete this._byId[model.cid];
            var id = this.modelId(model.attributes, model.idAttribute);
            if (id != null) delete this._byId[id];

            if (!options.silent) {
                options.index = index;
                model.trigger('remove', model, this, options);
            }

            removed.push(model);
            this._removeReference(model, options);
        }
        return removed;
    },

    // Internal method to create a model's ties to a collection.
    _addReference: function (model) {
        this._byId[model.cid] = model;
        var id = this.modelId(model.attributes, model.idAttribute);
        if (id != null) this._byId[id] = model;
        model.on('all', this._onModelEvent, this);
    },

    // Internal method to sever a model's ties to a collection.
    _removeReference: function (model) {
        delete this._byId[model.cid];
        var id = this.modelId(model.attributes, model.idAttribute);
        if (id != null) delete this._byId[id];
        if (this === model.collection) delete model.collection;
        model.off('all', this._onModelEvent, this);
    },

    // Internal method called every time a model in the set fires an event.
    // Sets need to update their indexes when models change ids. All other
    // events simply proxy through. "add" and "remove" events that originate
    // in other collections are ignored.
    _onModelEvent: function (event, model, collection, options) {
        if (model) {
            if ((event === 'add' || event === 'remove') && collection !== this) return;
            if (event === 'destroy') this.remove(model, options);
            if (event === 'changeId') {
                var prevId = this.modelId(model.previousAttributes(), model.idAttribute);
                var id = this.modelId(model.attributes, model.idAttribute);
                if (prevId != null) delete this._byId[prevId];
                if (id != null) this._byId[id] = model;
            }
        }
        this.trigger.apply(this, arguments);
    },
    // Proxy to set form attributes
    setForm() {
        return this.form.set.apply(this.form, arguments);
    },
    instanceForm() {
        if (!this.form) {
            var Model = this._global.Model;
            this.form = new Model;
        }
    },
    getForm() {
        return this.form;
    },
});

// Defining an @@iterator method implements JavaScript's Iterable protocol.
// In modern ES2015 browsers, this value is found at Symbol.iterator.
// global Symbol
var $$iterator = typeof Symbol === 'function' && Symbol.iterator;
if ($$iterator) {
    Collection.prototype[$$iterator] = Collection.prototype.values;
}

// CollectionIterator
// ------------------

// A CollectionIterator implements JavaScript's Iterator protocol, allowing the
// use of `for of` loops in modern browsers and interoperation between
// timeforce.Collection and other JavaScript functions and third-party libraries
// which can operate on Iterables.
var CollectionIterator = function (collection, kind) {
    this._collection = collection;
    this._kind = kind;
    this._index = 0;
};

// This "enum" defines the three possible kinds of values which can be emitted
// by a CollectionIterator that correspond to the values(), keys() and entries()
// methods on Collection, respectively.
var ITERATOR_VALUES = 1;
var ITERATOR_KEYS = 2;
var ITERATOR_KEYSVALUES = 3;

// All Iterators should themselves be Iterable.
if ($$iterator) {
    CollectionIterator.prototype[$$iterator] = function () {
        return this;
    };
}

CollectionIterator.prototype.next = function () {
    if (this._collection) {

        // Only continue iterating if the iterated collection is long enough.
        if (this._index < this._collection.length) {
            var model = this._collection.at(this._index);
            this._index++;

            // Construct a value depending on what kind of values should be iterated.
            var value;
            if (this._kind === ITERATOR_VALUES) {
                value = model;
            } else {
                var id = this._collection.modelId(model.attributes);
                if (this._kind === ITERATOR_KEYS) {
                    value = id;
                } else { // ITERATOR_KEYSVALUES
                    value = [id, model];
                }
            }
            return { value: value, done: false };
        }

        // Once exhausted, remove the reference to the collection so future
        // calls to the next method always return done.
        this._collection = void 0;
    }

    return { value: void 0, done: true };
};

export default Collection;