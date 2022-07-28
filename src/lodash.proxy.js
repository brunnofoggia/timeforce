import _ from 'lodash';
import { slice } from './helpers.js';

// Proxy timeforce class methods to Lodash functions, wrapping the model's
// `attributes` object or collection's `models` array behind the scenes.
//
// collection.filter(function(model) { return model.get('age') > 10 });
// collection.each(this.addView);
//
// `Function#apply` can be slow so we use the method's arg count, if we know it.
var addMethod = function (base, length, method, attribute) {
	switch (length) {
		case 1: return function () {
			return base[method](this[attribute]);
		};
		case 2: return function (value) {
			return base[method](this[attribute], value);
		};
		case 3: return function (iteratee, context) {
			return base[method](this[attribute], cb(iteratee, this), context);
		};
		case 4: return function (iteratee, defaultVal, context) {
			return base[method](this[attribute], cb(iteratee, this), defaultVal, context);
		};
		default: return function () {
			var args = slice.call(arguments);
			args.unshift(this[attribute]);
			return base[method].apply(base, args);
		};
	}
};

var addLodashMethods = function (Class, base, methods, attribute) {
	_.each(methods, function (length, method) {
		if (base[method]) Class.prototype[method] = addMethod(base, length, method, attribute);
	});
};

// Support `collection.sortBy('attr')` and `collection.findWhere({id: 1})`.
var cb = function (iteratee, instance) {
	if (_.isFunction(iteratee)) return iteratee;
	if (_.isObject(iteratee) && !instance._isModel(iteratee)) return modelMatcher(iteratee);
	if (_.isString(iteratee)) return function (model) { return model.get(iteratee); };
	return iteratee;
};
var modelMatcher = function (attrs) {
	var matcher = _.matches(attrs);
	return function (model) {
		return matcher(model.attributes);
	};
};

// Lodash methods that we want to implement on the Collection.
// 90% of the core usefulness of timeforce Collections is actually implemented
// right here:
var collectionMethods = {
	forEach: 3, each: 3, map: 3, collect: 3, reduce: 0,
	foldl: 0, inject: 0, reduceRight: 0, foldr: 0, find: 3, detect: 3, filter: 3,
	select: 3, reject: 3, every: 3, all: 3, some: 3, any: 3, include: 3, includes: 3,
	contains: 3, invoke: 0, max: 3, min: 3, toArray: 1, size: 1, first: 3,
	head: 3, take: 3, initial: 3, takeRight: 3, tail: 3, drop: 3, last: 3,
	without: 0, difference: 0, indexOf: 3, shuffle: 1, lastIndexOf: 3,
	isEmpty: 1, chain: 1, sample: 3, partition: 3, groupBy: 3, countBy: 3,
	sortBy: 3, mapKeys: 3, findIndex: 3, findLastIndex: 3
};


// Lodash methods that we want to implement on the Model, mapped to the
// number of arguments they take.
var modelMethods = {
	keys: 1, values: 1, toPairs: 1, invert: 1, pick: 0,
	omit: 0, chain: 1, isEmpty: 1
};

var mix = function (Collection, Model) {
	// Mix in each Lodash method as a proxy to `Collection#models`.
	_.each([
		[Collection, collectionMethods, 'models'],
		[Model, modelMethods, 'attributes']
	], function (config) {
		var Base = config[0],
			methods = config[1],
			attribute = config[2];

		Base.mixin = function (obj) {
			var mappings = _.reduce(_.functions(obj), function (memo, name) {
				memo[name] = 0;
				return memo;
			}, {});
			addLodashMethods(Base, obj, mappings, attribute);
		};

		addLodashMethods(Base, _, methods, attribute);
	});
};

export { addMethod, addLodashMethods, cb, modelMatcher, mix };