import _ from 'lodash';
import { fnfy } from './helpers.js';

// Global object
// -------------
var timeforce = {};

// For timeforce's purposes, jQuery, Zepto, Ender, or My Library (kidding) owns
// the `$` variable.
timeforce.$ = typeof window !== 'undefined' && window.$ || {};

// Enumerator for classes available
timeforce.types = {
    'model': 0,
    'collection': 1
};

// Name for types
timeforce.typeNames = _.invert(timeforce.types);

// A prototype inherited on Collections and Models
timeforce.globalPrototype = {
    // list of methods that will be added to the prototype (useful to work with generic abstractions among many classes when using ES6 classes)
    setMethodsOnPrototype: function () {
        var methods = _.result(this, 'mixMethods');
        if (!_.isPlainObject(methods) || !_.size(methods)) return;
        for (var name in methods) {
            this[name] = methods[name];
        }
    },
    // Method for checking whether an object should be considered a model for
    // the purposes of adding to the collection.
    _isModel: function (obj) {
        return obj instanceof this._global.Model;
    },
    // Method for checking whether an object should be considered a collection
    _isCollection: function (obj) {
        return obj instanceof this._global.Collection;
    },
    // Method for checking type of an instance between available classes
    _type(obj) {
        return this._isModel(obj) ? timeforce.types.model : timeforce.types.collection;
    },
    // Method for checking type name of an instance between available classes
    _typeName(obj) {
        return timeforce.typeNames[this._type(obj)];
    },
    // Help to discover if current instance is a Model
    isModel: function () {
        return this._isModel(this);
    },
    // Help to discover if current instance is a Collection
    isCollection: function () {
        return this._isCollection(this);
    },
    // Help to discover type of current instance
    type() {
        return this._type(this);
    },
    // Help to discover type name of current instance
    typeName() {
        return this._typeName(this);
    },
    //
    fnfy: function (path, object, context) {
        !object && typeof object === 'undefined' && (object = this);
        !context && typeof context === 'undefined' && (context = this);
        return fnfy(object, path, context);
    }
}

export default timeforce;