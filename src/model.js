import _ from 'lodash';
import timeforce from './global.js';
import { urlError, wrapError, fnfy } from './helpers.js';
import { Events } from './events.js';
import Deep from './deep.js';

// timeforce.Model
// --------------

// timeforce **Models** are the basic data object in the framework --
// frequently representing a row in a table in a database on your server.
// A discrete chunk of data and a bunch of useful, related methods for
// performing computations and transformations on that data.

// Create a new model with the specified attributes. A client id (`cid`)
// is automatically generated and assigned for you.
var Model = function (attributes, options) {
    var attrs = attributes || {};
    options || (options = {});
    this.setMethodsOnPrototype.apply(this);
    this.preinitialize.apply(this, arguments);
    _.each(this.preinitializePluginMethods, (name) => this[name].apply(this, arguments));
    this.cid = _.uniqueId(this.cidPrefix);
    this.attributes = {};
    if (options.collection) this.collection = options.collection;
    if (options.parse) attrs = this.parse(attrs, options) || {};
    var defaults = _.result(this, 'defaults');
    attrs = _.defaultsDeep(_.extend({}, defaults, attrs), defaults);
    this.set(attrs, options);
    this.changed = {};
    _.each(this.initializePluginMethods, (name) => this[name].apply(this, arguments));
    this.initialize.apply(this, arguments);
};

// Attach all inheritable methods to the Model prototype.
_.extend(Model.prototype, Events, timeforce.globalPrototype, {
    // global
    _global: timeforce,

    // A name to identify a class
    name: null,

    // A hash of attributes whose current and previous value differ.
    changed: null,

    // The value returned during the last failed validation.
    validationError: null,

    // The default name for the JSON `id` attribute is `"id"`. MongoDB and
    // CouchDB users may want to set this to `"_id"`.
    idAttribute: 'id',

    // The prefix is used to create the client id which is used to identify models locally.
    // You may want to override this if you're experiencing name clashes with model ids.
    cidPrefix: 'm',

    // preinitialize is an empty function by default. You can override it with a function
    // or object.  preinitialize will run before any instantiation logic is run in the Model.
    preinitialize: function () { },

    // preinitialize plugin methods is a list of method names that will run after preinitialize method is run in the Model.
    preinitializePluginMethods: [],

    // initialize plugin methods is a list of method names that will run before the initialize method is run in the Model.
    initializePluginMethods: [],

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function () { },

    // Return a copy of the model's `attributes` object.
    toJSON: function () {
        return _.cloneDeep(this.attributes);
    },

    // Proxy `timeforce.sync` by default -- but override this if you need
    // custom syncing semantics for *this* particular model.
    sync: function () {
        return this._global.sync.apply(this, arguments);
    },

    // Get the value of an attribute.
    get: function (attr) {
        return Deep.search(this.attributes, attr);
    },

    // Get the HTML-escaped value of an attribute.
    escape: function (attr) {
        return _.escape(this.get(attr));
    },

    // Returns `true` if the attribute contains a value that is not null
    // or undefined.
    has: function (attr) {
        return this.get(attr) != null;
    },

    // Special-cased proxy to Lodash's `_.matches` method.
    matches: function (attrs) {
        return !!_.iteratee(attrs, this)(this.attributes);
    },

    // Set a hash of model attributes on the object, firing `"change"`. This is
    // the core primitive operation of a model, updating the data and notifying
    // anyone who needs to know about the change in state. The heart of the beast.
    set: function (key, val, options) {
        if (key == null) return this;

        // Handle both `"key", value` and `{key: value}` -style arguments.
        var attrs;
        if (typeof key === 'object') {
            attrs = key;
            options = val;
        } else {
            (attrs = {})[key] = val;
        }

        options || (options = {});

        // Run validation.
        if (!this._validate(attrs, options)) return false;

        // Extract attributes and options.
        var silent = options.silent;
        var changes = [];
        var changing = this._changing;
        this._changing = true;

        if (!changing) {
            this._previousAttributes = _.cloneDeep(this.attributes);
            this.changed = {};
        }

        // var current = this.attributes;
        var changed = this.changed;
        var prev = this._previousAttributes;

        var prevPlain = Deep.join(prev);
        var currentPlain = Deep.join(this.attributes);
        var attrsPlain = Deep.join(attrs);

        // collect changes
        for (let attr in attrsPlain) {
            val = attrsPlain[attr];
            if (!_.isEqual(currentPlain[attr], val)) changes.push(Deep.trail(attr, true).reverse());
            if (!_.isEqual(prevPlain[attr], val)) {
                changed[attr] = val;
            } else {
                delete changed[attr];
            }
        }
        // `set` attribute, update or delete the current attributes.
        this.attributes = Deep.set(this.attributes, attrsPlain, _.pick(options, 'unset'));

        currentPlain = Deep.join(this.attributes);


        // Update the `id`.
        if (this.idAttribute in attrsPlain) {
            var prevId = this.id;
            this.id = this.get(this.idAttribute);
            this.trigger('changeId', this, prevId, options);
        }

        // Trigger all relevant attribute changes.
        if (!silent) {
            if (changes.length) this._pending = options;
            // walk through attrs changes
            for (var i = 0; i < changes.length; i++) {
                let change = changes[i];

                // walk through trail of changes
                for (var j = 0; j < change.length; j++) {
                    let trail = change[j];
                    this.trigger('change:' + trail, this, currentPlain[change[0]], options);
                }
            }
        }

        // You might be wondering why there's a `while` loop here. Changes can
        // be recursively nested within `"change"` events.
        if (changing) return this;
        if (!silent) {
            while (this._pending) {
                options = this._pending;
                this._pending = false;
                this.trigger('change', this, options);
            }
        }
        this._pending = false;
        this._changing = false;
        return this;
    },

    // Remove an attribute from the model, firing `"change"`. `unset` is a noop
    // if the attribute doesn't exist.
    unset: function (attr, options) {
        return this.set(attr, void 0, _.extend({}, options, { unset: true }));
    },

    // Clear all attributes on the model, firing `"change"`.
    clear: function (options) {
        var attrs = {};
        for (var key in this.attributes) attrs[key] = void 0;
        return this.set(attrs, _.extend({}, options, { unset: true }));
    },

    // Determine if the model has changed since the last `"change"` event.
    // If you specify an attribute name, determine if that attribute has changed.
    hasChanged: function (attr) {
        if (attr == null) return !_.isEmpty(this.changed);
        return _.has(this.changed, attr);
    },

    // Return an object containing all the attributes that have changed, or
    // false if there are no changed attributes. Useful for determining what
    // parts of a view need to be updated and/or what attributes need to be
    // persisted to the server. Unset attributes will be set to undefined.
    // You can also pass an attributes object to diff against the model,
    // determining if there *would be* a change.
    changedAttributes: function (diff) {
        if (!diff) return this.hasChanged() ? _.cloneDeep(this.changed) : false;
        var old = Deep.join(this._changing ? this._previousAttributes : this.attributes);
        var changed = {};
        var hasChanged;
        for (var attr in diff) {
            var val = diff[attr];
            if (_.isEqual(old[attr], val)) continue;
            changed[attr] = val;
            hasChanged = true;
        }
        return hasChanged ? changed : false;
    },

    // Get the previous value of an attribute, recorded at the time the last
    // `"change"` event was fired.
    previous: function (attr) {
        if (attr == null || !this._previousAttributes) return null;
        return Deep.search(this._previousAttributes, attr);
    },

    // Get all of the attributes of the model at the time of the previous
    // `"change"` event.
    previousAttributes: function () {
        return _.cloneDeep(this._previousAttributes);
    },

    // Fetch the model from the server, merging the response with the model's
    // local attributes. Any changed attributes will trigger a "change" event.
    fetch: function (options) {
        options = _.extend({ parse: true, caller: 'fetch' }, options);
        var model = this;
        var success = options.success;
        options.success = function (resp) {
            var serverAttrs = options.parse ? model.parse(resp, options) : resp;
            if (!model.set(serverAttrs, options)) return false;
            if (success) success.call(options.context, model, resp, options);
            model.trigger('fetch', model, resp, options);
            model.trigger('sync', model, resp, options);
        };
        wrapError(this, options, 'fetch');
        return this.sync('read', this, options);
    },

    // Set a hash of model attributes, and sync the model to the server.
    // If the server returns an attributes hash that differs, the model's
    // state will be `set` again.
    save: function (key, val, options) {
        // Handle both `"key", value` and `{key: value}` -style arguments.
        var attrs;
        if (key == null || typeof key === 'object') {
            attrs = key;
            options = val;
        } else {
            (attrs = {})[key] = val;
        }

        options = _.extend({ validate: true, validateForServer: true, parse: true, caller: 'save' }, options);
        var wait = options.wait;

        // If we're not waiting and attributes exist, save acts as
        // `set(attr).save(null, opts)` with validation. Otherwise, check if
        // the model will be valid when the attributes, if any, are set.
        if (attrs && !wait) {
            if (!this.set(attrs, options)) return false;
        } else if (!this._validate(attrs, options)) {
            return false;
        }

        // After a successful server-side save, the client is (optionally)
        // updated with the server-side state.
        var model = this;
        var success = options.success;
        var attributes = this.attributes;
        options.success = function (resp) {
            // Ensure attributes are restored during synchronous saves.
            model.attributes = attributes;
            var serverAttrs = options.parse ? model.parse(resp, options) : resp;
            if (wait) serverAttrs = _.extend({}, attrs, serverAttrs);
            if (serverAttrs && !model.set(serverAttrs, options)) return false;
            if (success) success.call(options.context, model, resp, options);
            model.trigger('save', model, resp, options);
            model.trigger('sync', model, resp, options);
        };
        wrapError(this, options, 'save');

        // Set temporary attributes if `{wait: true}` to properly find new ids.
        if (attrs && wait) this.attributes = _.extend({}, attributes, attrs);

        var method = this.isNew() ? 'create' : options.patch ? 'patch' : 'update';
        if (method === 'patch' && !options.attrs) options.attrs = attrs;
        var xhr = this.sync(method, this, options);

        // Restore attributes.
        this.attributes = attributes;

        return xhr;
    },

    // Destroy this model on the server if it was already persisted.
    // Optimistically removes the model from its collection, if it has one.
    // If `wait: true` is passed, waits for the server to respond before removal.
    destroy: function (options) {
        options = options ? _.clone(options) : {};
        options.caller = 'destroy';
        var model = this;
        var success = options.success;
        var wait = options.wait;

        var destroy = function () {
            model.stopListening();
            model.trigger('destroy', model, model.collection, options);
        };

        options.success = function (resp) {
            if (wait) destroy();
            if (success) success.call(options.context, model, resp, options);
            if (!model.isNew()) model.trigger('sync', model, resp, options);
        };

        var xhr = false;
        if (this.isNew()) {
            _.defer(options.success);
        } else {
            wrapError(this, options, 'destroy');
            xhr = this.sync('delete', this, options);
        }
        if (!wait) destroy();
        return xhr;
    },

    // Default URL for the model's representation on the server -- if you're
    // using timeforce's restful methods, override this to change the endpoint
    // that will be called.
    url: function () {
        var base =
            _.result(this, 'urlRoot') ||
            _.result(this.collection, 'url') ||
            urlError();
        if (this.isNew()) return base;
        var id = this.get(this.idAttribute);
        return base.replace(/[^\/]$/, '$&/') + encodeURIComponent(id);
    },

    // **parse** converts a response into the hash of attributes to be `set` on
    // the model. The default implementation is just to pass the response along.
    parse: function (resp) {
        return resp;
    },

    // Create a new model with identical attributes to this one.
    clone: function () {
        return new this.constructor(_.cloneDeep(this.attributes));
    },

    // A model is new if it has never been saved to the server, and lacks an id.
    isNew: function () {
        return !this.has(this.idAttribute);
    },

    // Check if the model is currently in a valid state.
    isValid: function (options) {
        return this._validate({}, _.extend({}, options, { validate: true }));
    },

    // Run validation against the next complete set of model attributes,
    // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
    _validate: function (attrs, options) {
        if (!options.validate || !this.validate) return true;
        attrs = _.extend({}, this.attributes, attrs);
        var error = this.validationError = this.validate(attrs, options) || null;
        if (!error) return true;
        this.trigger('invalid', this, error, _.extend(options, { validationError: error }));
        return false;
    },
});

export default Model;