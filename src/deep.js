import _ from 'lodash';

var Deep = {};

// join is a function that creates a plain json from a multilevel.
// delivering a json like this jsonPlain = { name: 'bruno foggia', 'contacts.0.email': 'team@99xp.org', 'contacts.0.address.0.zipcode': '000', 'dados.document': '111'};
Deep.join = function (attrs) {
    var json = {};
    for (let index in attrs) {
        let attr = attrs[index];
        if (!_.isObject(attr) || !_.size(attr)) json[index] = attr;
        else {
            var _json = !_.isObject(attr) ? _.pick(attrs, index) : join(attr, index);
            // var _json = join(attr, index);
            // if (Deep.log) console.log('---', attrs, index, attr, 'join this', _json, 'with this', json);

            json = _.defaultsDeep(json, _json);
            // if (Deep.log) console.log(`json now `, json);
        }
    }

    return json;
};

var join = function (_attrs, _key) {
    var json = {};
    if (_.isPlainObject(_attrs) || _.isArray(_attrs)) {
        for (let index in _attrs) {
            let attr = _attrs[index];
            let _json = join(attr, [_key, index].join('.'));

            json = _.defaultsDeep(json, _json);
        }
    } else {
        json[_key] = _attrs;
    }
    return json;
}


// split is a function that creates a multilevel json from a plain.
// receiving a json like this jsonPlain = { name: 'bruno foggia', 'contacts.0.email': 'team@99xp.org', 'contacts.0.address.0.zipcode': '000', 'dados.document': '111'};
// and delivering this json = { name: 'bruno foggia', contacts: [ { email: 'team@99xp.org', address: [ { zipcode: '000', }, ] }, ], dados: { document: '111', } };
Deep.split = function (attrs) {
    var json = {};
    for (let index in attrs) {
        let value = attrs[index];
        var _json = split(value, index.split('.'));
        json = _.defaultsDeep(json, _json);
    }

    return json;
};

var split = function (_value, _keys, json = {}) {
    let key = _keys.shift();
    if (_keys.length > 0) {
        let nextKey = _keys[0];
        let isIntNextKey = /^[0-9]+$/.test(nextKey);


        json[key] = split(_value, _keys, isIntNextKey ? [] : {});
    } else {
        json[key] = _value;
    }
    return json;
}

// trail will say every index composition walked on a path to get a value
// for example 'contacts.0.address.0.estado' would lead to
// [ 'contacts', 'contacts.0', 'contacts.0.address', 'contacts.0.address.0', 'contacts.0.address.0.estado' ]
Deep.trail = function (_key, _recursive = false) {
    var trail = [],
        recursiveTrail = [];
    var keys = _key.split('.');
    for (let x in keys) {
        let key = keys[x];
        let lastTrail = parseInt(x, 10) > 0 ? trail[parseInt(x, 10) - 1] : null;
        let trailItem = !lastTrail ? key : [lastTrail, key].join('.');

        trail.push(trailItem);
        _recursive && /\.[0-9]+\./.test(trailItem) && recursiveTrail.push(trailItem.replace(/(\.)[0-9]+(\.)/g, '..'));

    }
    _recursive && (trail = _.concat(recursiveTrail, trail));


    return trail;
};

// search will find a value by its path
Deep.search = function (attrs, path, defaultValue) {
    path = path + '';
    var value = defaultValue;
    var pathArray = path.split(/\.\./g);

    if (pathArray.length === 2) {
        value = [];
        _.each(pathArray, (path) => {
            if (attrs) {
                if (_.isArray(attrs)) {
                    return _.each(attrs, (attr, index) => {
                        var position = parseInt(index, 10) + 1,
                            last = attrs.length === position;

                        // this will handle deleted items from an object
                        if (typeof attr === 'undefined') { return value.push(SyntaxError); }

                        let valueFound = Deep.search(attr, path);
                        // if (typeof valueFound !== 'undefined' || last) { value.push(valueFound); }
                        value.push(valueFound);
                    });
                } else
                    attrs = Deep.search(attrs, path);
            }
        })
    } else {
        pathArray = path.split(/\./g);
        let valueFound = attrs;
        _.each(pathArray, (path) => {
            try {
                valueFound = valueFound[path];
            } catch (e) {
                valueFound = undefined;
            }
        });

        if (typeof valueFound !== 'undefined') { value = valueFound; }
    }

    return value;
};

// set will recursivelly merge 2 objects
// use options.unset to unset data
Deep.set = function (current, _changed, options) {
    var changed = Deep.join(_changed);
    // if (Deep.log) console.log('changed', _changed, changed);

    var result = {};

    for (var field in changed) {
        let value = changed[field];
        // if (Deep.log) console.log('field', field, 'value', value);
        result = set(!_.size(result) ? current : result, field.split('.'), value, options);
    }

    // if (Deep.log) console.log('set ended', result);
    return result;
};

var set = function (json, keys, value, options = {}) {
    let key = keys.shift();
    if (keys.length > 0) {
        // if (Deep.log) console.log('keys', keys, 'key', key);
        let nextKey = keys[0];
        let isIntNextKey = /^[0-9]+$/.test(nextKey);
        let isArray = _.isArray(json[key]);

        let source = !options.unset || keys.length > 1 ? json[key] : _.omit(json[key], nextKey);
        let result = set(source || (isIntNextKey ? [] : {}), keys, value, options);
        // if (Deep.log) console.log('source', source, 'result', result);

        json[key] = _.defaultsDeep(result, source);
        if (isArray) json[key] = _.toArray(json[key]);
    } else if (!options.unset) {
        json[key] = value;
        // if (Deep.log) console.log('keys', keys, 'key', key, value, json);
    } else {
        json = _.omit(json, key);
    }
    return json;
};


export default Deep;