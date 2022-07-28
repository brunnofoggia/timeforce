import _ from 'lodash';
import timeforce from './global.js';
import { urlError, jsonToQueryString } from './helpers.js';
import Mock from './mock.js';


// timeforce.sync
// -------------

// Override this function to change the manner in which timeforce persists
// models data to, for example, the server. You will be passed the type of request, and the
// model in question. By default, makes a RESTful Ajax request
// to the model's `url()`. Some possible customizations could be:
//
// * Use `setTimeout` to batch rapid-fire updates into a single request.
// * Send up the models as XML instead of JSON.
// * Persist models via WebSockets instead of Ajax.
var Sync = {};

// Turn on `emulateJSON` to support legacy servers that can't deal with direct
// `application/json` requests ... this will encode the body as
// `application/x-www-form-urlencoded` instead and will send the model in a
// form param named `model`.
Sync.emulateJSON = false;

Sync.sync = function (context, method, instance, options, config) {
    var type = methodMap[method];

    // Default options, unless specified.
    _.defaultsDeep(options || (options = {}), {
        emulateJSON: timeforce.emulateJSON
    });

    // Default options, unless specified.
    config = context.syncConfig(config || {});

    // Default JSON-request options.
    var params = { type, method: type.toLowerCase(), responseType: 'json', url: options.url };

    // Ensure that we have a URL.
    if (!params.url) {
        params.url = _.result(instance, 'url') || urlError();
    }

    params.contentType = 'application/json';
    // Ensure that we have the appropriate request data.
    if (options.data == null && instance && ((method === 'read' && instance.isCollection()) || method === 'create' || method === 'update' || method === 'patch')) {
        options.data = _.cloneDeep(options.attrs) || (instance.isModel() ? _.cloneDeep(instance.toJSON(options)) : _.cloneDeep(instance.form?.toJSON()) || null);
    }
    // Makes possible to fetch lists with filters, pagination and more
    if (instance.isCollection() && method === 'read' && options.data) {
        params.url += !/\?/.test(params.url) ? '?' : '&';

        const querystring = jsonToQueryString(options.data);

        params.url += options.querystring = querystring;
        options.data = null;
    }

    // For older servers, emulate JSON by encoding the request into an HTML-form.
    if (options.emulateJSON) {
        params.contentType = 'application/x-www-form-urlencoded';
        options.data = options.data ? { model: JSON.stringify(options.data) } : {};
    }

    // Don't process data on a non-GET request.
    if (params.type !== 'GET' && !options.emulateJSON) {
        params.processData = false;
    }

    // Pass along `textStatus` and `errorThrown` from jQuery.
    var error = options.error;
    options.error = function (xhr, textStatus, errorThrown) {
        options.textStatus = textStatus;
        options.errorThrown = errorThrown;
        if (typeof error === 'function') {
            _.bind(error, options.context)(xhr, textStatus, errorThrown);
        }
        // error.call(options.context || null, xhr, textStatus, errorThrown);
    };

    // Make the request, allowing the user to override any Ajax options.
    var persist = _.result(instance, 'mock') === true || _.result(context, 'mock') === true ? Mock.persist : context.persist;
    var xhr = options.xhr = persist(_.extend(params, options), config, instance);
    instance.trigger('request', instance, xhr, _.extend(params, options, { method }));
    if (options.caller) {
        instance.trigger(['request', options.caller].join(':'), instance, xhr, _.extend(params, options, { method }));
    }
    return xhr;
};

// ABstraction that allows to integrate with other tools like axios
Sync.syncConfig = function (config) {
    // Default options, unless specified.
    return config;
};

// Map from CRUD to HTTP for our default `timeforce.sync` implementation.
var methodMap = {
    create: 'POST',
    update: 'PUT',
    patch: 'PATCH',
    delete: 'DELETE',
    read: 'GET'
};

// Set the default implementation of `timeforce.persist` to proxy through to `$`.
// Override this if you'd like to use a different library.
Sync.persist = function (options) {
    return new Promise((resolve) => {
        options.success(options.data);
        resolve(options.data);
    });
};

export default Sync;