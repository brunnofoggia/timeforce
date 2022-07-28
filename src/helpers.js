import _ from 'lodash';

// Helpers
// -------

// Create a local reference to a common array method we'll want to use later.
var slice = Array.prototype.slice;

// Helper function to correctly set up the prototype chain for subclasses.
// Similar to `goog.inherits`, but uses a hash of prototype properties and
// class properties to be extended.
var extend = function (protoProps, staticProps) {
    var parent = this;
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent constructor.
    if (protoProps && _.has(protoProps, 'constructor')) {
        child = protoProps.constructor;
    } else {
        child = function () { return parent.apply(this, arguments); };
    }

    // Add static properties to the constructor function, if supplied.
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function and add the prototype properties.
    child.prototype = _.create(parent.prototype, protoProps);
    child.prototype.constructor = child;

    // Set a convenience property in case the parent's prototype is needed
    // later.
    child.__super__ = parent.prototype;

    return child;
};

// Throw an error when a URL is needed, and none is supplied.
var urlError = function () {
    throw new Error('A "url" property or function must be specified');
};

// Wrap an optional error callback with a fallback error event.
var wrapError = function (model, options, eventPrefix = '') {
    var error = options.error,
        eventName = [];
    eventPrefix && eventName.push(eventPrefix);
    eventName.push('error');

    options.error = function (resp) {
        if (error) error.call(options.context, model, resp, options);
        model.trigger('error', model, resp, options);
        if (eventName.length === 2)
            model.trigger(eventName.join(':'), model, resp, options);
    };
};

// Turns a value into a output function if it's not a function already
var fnfy = function (object, path, context) {
    var fn = _.isFunction(object[path]) ? object[path] : () => object[path];
    return context ? _.bind(fn, context) : fn;
};

var jsonToQueryString = function (params, skipobjects, prefix) {
    if (skipobjects === void 0) {
        skipobjects = false;
    }
    if (prefix === void 0) {
        prefix = "";
    }
    var result = "";
    if (typeof (params) != "object") {
        return prefix + "=" + encodeURIComponent(params) + "&";
    }
    for (var param in params) {
        var c = "" + prefix + "" + (prefix != "" ? "[" : "") + param + (prefix != "" ? "]" : "");
        if (_.isObject(params[param]) && !skipobjects) {
            result += jsonToQueryString(params[param], false, "" + c);
        } else if (Array.isArray(params[param]) && !skipobjects) {
            params[param].forEach(function (item, ind) {
                result += jsonToQueryString(item, false, c + "[" + ind + "]");
            });
        } else {
            result += c + "=" + encodeURIComponent(params[param]) + "&";
        }
    }
    return result;
};

export { slice, extend, urlError, wrapError, fnfy, jsonToQueryString };