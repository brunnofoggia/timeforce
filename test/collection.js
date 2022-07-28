import assert from 'assert';
import _ from 'lodash';
import { env, timeforce, jsonToQueryString } from './setup.js';

describe('Collection', function () {

    var a, b, c, d, e, col, otherCol;


    beforeEach(async (done) => {
        try {
            timeforce.mock = false;
            a = new timeforce.Model({ id: 3, label: 'a' });
            b = new timeforce.Model({ id: 2, label: 'b' });
            c = new timeforce.Model({ id: 1, label: 'c' });
            d = new timeforce.Model({ id: 0, label: 'd' });
            e = null;
            col = new timeforce.Collection([a, b, c, d]);
            otherCol = new timeforce.Collection();
            done();

        } catch (err) {
            console.log('error', err);

        }
    });


    it('new and sort', function () {
        // assert.expect(6);
        var counter = 0;
        col.on('sort', function () { counter++; });
        assert.deepEqual(col.pluck('label'), ['a', 'b', 'c', 'd']);
        col.comparator = function (m1, m2) {
            return m1.id > m2.id ? -1 : 1;
        };
        col.sort();
        assert.equal(counter, 1);
        assert.deepEqual(col.pluck('label'), ['a', 'b', 'c', 'd']);
        col.comparator = function (model) { return model.id; };
        col.sort();
        assert.equal(counter, 2);
        assert.deepEqual(col.pluck('label'), ['d', 'c', 'b', 'a']);
        assert.equal(col.length, 4);
    });

    it('String comparator.', function () {
        // assert.expect(1);
        var collection = new timeforce.Collection([
            { id: 3 },
            { id: 1 },
            { id: 2 }
        ], { comparator: 'id' });
        assert.deepEqual(collection.pluck('id'), [1, 2, 3]);
    });

    it('new and parse', function () {
        // assert.expect(3);
        var Collection = timeforce.Collection.extend({
            parse: function (data) {
                return _.filter(data, function (datum) {
                    return datum.a % 2 === 0;
                });
            }
        });
        var models = [{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }];
        var collection = new Collection(models, { parse: true });
        assert.strictEqual(collection.length, 2);
        assert.strictEqual(collection.first().get('a'), 2);
        assert.strictEqual(collection.last().get('a'), 4);
    });

    it('clone preserves model and comparator', function () {
        // assert.expect(3);
        var Model = timeforce.Model.extend();
        var comparator = function (model) { return model.id; };

        var collection = new timeforce.Collection([{ id: 1 }], {
            model: Model,
            comparator: comparator
        }).clone();
        collection.add({ id: 2 });
        assert.ok(collection.at(0) instanceof Model);
        assert.ok(collection.at(1) instanceof Model);
        assert.strictEqual(collection.comparator, comparator);
    });

    it('get', function () {
        // assert.expect(6);
        assert.equal(col.get(0), d);
        assert.equal(col.get(d.clone()), d);
        assert.equal(col.get(2), b);
        assert.equal(col.get({ id: 1 }), c);
        assert.equal(col.get(c.clone()), c);
        assert.equal(col.get(col.first().cid), col.first());
    });

    it('get with non-default ids', function () {
        // assert.expect(5);
        var MongoModel = timeforce.Model.extend({ idAttribute: '_id' });
        var model = new MongoModel({ _id: 100 });
        var collection = new timeforce.Collection([model], { model: MongoModel });
        assert.equal(collection.get(100), model);
        assert.equal(collection.get(model.cid), model);
        assert.equal(collection.get(model), model);
        assert.equal(collection.get(101), void 0);

        var collection2 = new timeforce.Collection();
        collection2.model = MongoModel;
        collection2.add(model.attributes);
        assert.equal(collection2.get(model.clone()), collection2.first());
    });

    it('has', function () {
        // assert.expect(15);
        assert.ok(col.has(a));
        // assert.ok(col.has(b));
        // assert.ok(col.has(c));
        // assert.ok(col.has(d));
        // assert.ok(col.has(a.id));
        // assert.ok(col.has(b.id));
        // assert.ok(col.has(c.id));
        // assert.ok(col.has(d.id));
        // assert.ok(col.has(a.cid));
        // assert.ok(col.has(b.cid));
        // assert.ok(col.has(c.cid));
        // assert.ok(col.has(d.cid));
        var outsider = new timeforce.Model({ id: 4 });
        // assert.notOk(col.has(outsider));
        // assert.notOk(col.has(outsider.id));
        // assert.notOk(col.has(outsider.cid));
    });

    it('update index when id changes', function () {
        // assert.expect(6);
        var collection = new timeforce.Collection();
        collection.add([
            { id: 0, name: 'one' },
            { id: 1, name: 'two' }
        ]);
        var one = collection.get(0);
        assert.equal(one.get('name'), 'one');
        collection.on('change:name', function (model) {
            assert.ok(this.get(model));
            assert.equal(model, this.get(101));
            assert.equal(this.get(0), null);
        });
        one.set({ name: 'dalmatians', id: 101 });
        assert.equal(collection.get(0), null);
        assert.equal(collection.get(101).get('name'), 'dalmatians');
    });

    it('at', function () {
        // assert.expect(2);
        assert.equal(col.at(2), c);
        assert.equal(col.at(-2), c);
    });

    it('pluck', function () {
        // assert.expect(1);
        assert.equal(col.pluck('label').join(' '), 'a b c d');
    });

    it('add', function () {
        // assert.expect(14);
        var added, opts, secondAdded;
        added = opts = secondAdded = null;
        e = new timeforce.Model({ id: 10, label: 'e' });
        otherCol.add(e);
        otherCol.on('add', function () {
            secondAdded = true;
        });
        col.on('add', function (model, collection, options) {
            added = model.get('label');
            opts = options;
        });
        col.add(e, { amazing: true });
        assert.equal(added, 'e');
        assert.equal(col.length, 5);
        assert.equal(col.last(), e);
        assert.equal(otherCol.length, 1);
        assert.equal(secondAdded, null);
        assert.ok(opts.amazing);

        var f = new timeforce.Model({ id: 20, label: 'f' });
        var g = new timeforce.Model({ id: 21, label: 'g' });
        var h = new timeforce.Model({ id: 22, label: 'h' });
        var atCol = new timeforce.Collection([f, g, h]);
        assert.equal(atCol.length, 3);
        atCol.add(e, { at: 1 });
        assert.equal(atCol.length, 4);
        assert.equal(atCol.at(1), e);
        assert.equal(atCol.last(), h);

        var coll = new timeforce.Collection(new Array(2));
        var addCount = 0;
        coll.on('add', function () {
            addCount += 1;
        });
        coll.add([undefined, f, g]);
        assert.equal(coll.length, 5);
        assert.equal(addCount, 3);
        coll.add(new Array(4));
        assert.equal(coll.length, 9);
        assert.equal(addCount, 7);
    });

    it('add multiple models', function () {
        // assert.expect(6);
        var collection = new timeforce.Collection([{ at: 0 }, { at: 1 }, { at: 9 }]);
        collection.add([{ at: 2 }, { at: 3 }, { at: 4 }, { at: 5 }, { at: 6 }, { at: 7 }, { at: 8 }], { at: 2 });
        for (var i = 0; i <= 5; i++) {
            assert.equal(collection.at(i).get('at'), i);
        }
    });

    it('add; at should have preference over comparator', function () {
        // assert.expect(1);
        var Col = timeforce.Collection.extend({
            comparator: function (m1, m2) {
                return m1.id > m2.id ? -1 : 1;
            }
        });

        var collection = new Col([{ id: 2 }, { id: 3 }]);
        collection.add(new timeforce.Model({ id: 1 }), { at: 1 });

        assert.equal(collection.pluck('id').join(' '), '3 1 2');
    });

    it('add; at should add to the end if the index is out of bounds', function () {
        // assert.expect(1);
        var collection = new timeforce.Collection([{ id: 2 }, { id: 3 }]);
        collection.add(new timeforce.Model({ id: 1 }), { at: 5 });

        assert.equal(collection.pluck('id').join(' '), '2 3 1');
    });

    it("can't add model to collection twice", function () {
        var collection = new timeforce.Collection([{ id: 1 }, { id: 2 }, { id: 1 }, { id: 2 }, { id: 3 }]);
        assert.equal(collection.pluck('id').join(' '), '1 2 3');
    });

    it("can't add different model with same id to collection twice", function () {
        // assert.expect(1);
        var collection = new timeforce.Collection;
        collection.unshift({ id: 101 });
        collection.add({ id: 101 });
        assert.equal(collection.length, 1);
    });

    it('merge in duplicate models with {merge: true}', function () {
        // assert.expect(3);
        var collection = new timeforce.Collection;
        collection.add([{ id: 1, name: 'Moe' }, { id: 2, name: 'Curly' }, { id: 3, name: 'Larry' }]);
        collection.add({ id: 1, name: 'Moses' });
        assert.equal(collection.first().get('name'), 'Moe');
        collection.add({ id: 1, name: 'Moses' }, { merge: true });
        assert.equal(collection.first().get('name'), 'Moses');
        collection.add({ id: 1, name: 'Tim' }, { merge: true, silent: true });
        assert.equal(collection.first().get('name'), 'Tim');
    });

    it('add model to multiple collections', function () {
        // assert.expect(10);
        var counter = 0;
        var m = new timeforce.Model({ id: 10, label: 'm' });
        m.on('add', function (model, collection) {
            counter++;
            assert.equal(m, model);
            if (counter > 1) {
                assert.equal(collection, col2);
            } else {
                assert.equal(collection, col1);
            }
        });
        var col1 = new timeforce.Collection([]);
        col1.on('add', function (model, collection) {
            assert.equal(m, model);
            assert.equal(col1, collection);
        });
        var col2 = new timeforce.Collection([]);
        col2.on('add', function (model, collection) {
            assert.equal(m, model);
            assert.equal(col2, collection);
        });
        col1.add(m);
        assert.equal(m.collection, col1);
        col2.add(m);
        assert.equal(m.collection, col1);
    });

    it('add model with parse', function () {
        // assert.expect(1);
        var Model = timeforce.Model.extend({
            parse: function (obj) {
                obj.value += 1;
                return obj;
            }
        });

        var Col = timeforce.Collection.extend({ model: Model });
        var collection = new Col;
        collection.add({ value: 1 }, { parse: true });
        assert.equal(collection.at(0).get('value'), 2);
    });

    it('add with parse and merge', function () {
        var collection = new timeforce.Collection();
        collection.parse = function (attrs) {
            return _.map(attrs, function (model) {
                if (model.model) return model.model;
                return model;
            });
        };
        collection.add({ id: 1 });
        collection.add({ model: { id: 1, name: 'Alf' } }, { parse: true, merge: true });
        assert.equal(collection.first().get('name'), 'Alf');
    });

    it('add model to collection with sort()-style comparator', function () {
        // assert.expect(3);
        var collection = new timeforce.Collection;
        collection.comparator = function (m1, m2) {
            return m1.get('name') < m2.get('name') ? -1 : 1;
        };
        var tom = new timeforce.Model({ name: 'Tom' });
        var rob = new timeforce.Model({ name: 'Rob' });
        var tim = new timeforce.Model({ name: 'Tim' });
        collection.add(tom);
        collection.add(rob);
        collection.add(tim);
        assert.equal(collection.indexOf(rob), 0);
        assert.equal(collection.indexOf(tim), 1);
        assert.equal(collection.indexOf(tom), 2);
    });

    it('comparator that depends on `this`', function () {
        // assert.expect(2);
        var collection = new timeforce.Collection;
        collection.negative = function (num) {
            return -num;
        };
        collection.comparator = function (model) {
            return this.negative(model.id);
        };
        collection.add([{ id: 1 }, { id: 2 }, { id: 3 }]);
        assert.deepEqual(collection.pluck('id'), [3, 2, 1]);
        collection.comparator = function (m1, m2) {
            return this.negative(m2.id) - this.negative(m1.id);
        };
        collection.sort();
        assert.deepEqual(collection.pluck('id'), [1, 2, 3]);
    });

    it('remove', function () {
        // assert.expect(12);
        var removed = null;
        var result = null;
        col.on('remove', function (model, collection, options) {
            removed = model.get('label');
            assert.equal(options.index, 3);
            assert.equal(collection.get(model), undefined, '#3693: model cannot be fetched from collection');
        });
        result = col.remove(d);
        assert.equal(removed, 'd');
        assert.strictEqual(result, d);
        //if we try to remove d again, it's not going to actually get removed
        result = col.remove(d);
        assert.strictEqual(result, undefined);
        assert.equal(col.length, 3);
        assert.equal(col.first(), a);
        col.off();
        result = col.remove([c, d]);
        assert.equal(result.length, 1, 'only returns removed models');
        assert.equal(result[0], c, 'only returns removed models');
        result = col.remove([c, b]);
        assert.equal(result.length, 1, 'only returns removed models');
        assert.equal(result[0], b, 'only returns removed models');
        result = col.remove([]);
        assert.deepEqual(result, [], 'returns empty array when nothing removed');
    });

    it('add and remove return values', function () {
        // assert.expect(13);
        var Even = timeforce.Model.extend({
            validate: function (attrs) {
                if (attrs.id % 2 !== 0) return 'odd';
            }
        });
        var collection = new timeforce.Collection;
        collection.model = Even;

        var list = collection.add([{ id: 2 }, { id: 4 }], { validate: true });
        assert.equal(list.length, 2);
        assert.ok(list[0] instanceof timeforce.Model);
        assert.equal(list[1], collection.last());
        assert.equal(list[1].get('id'), 4);

        list = collection.add([{ id: 3 }, { id: 6 }], { validate: true });
        assert.equal(collection.length, 3);
        assert.equal(list[0], false);
        assert.equal(list[1].get('id'), 6);

        var result = collection.add({ id: 6 });
        assert.equal(result.cid, list[1].cid);

        result = collection.remove({ id: 6 });
        assert.equal(collection.length, 2);
        assert.equal(result.id, 6);

        list = collection.remove([{ id: 2 }, { id: 8 }]);
        assert.equal(collection.length, 1);
        assert.equal(list[0].get('id'), 2);
        assert.equal(list[1], null);
    });

    it('shift and pop', function () {
        // assert.expect(2);
        var collection = new timeforce.Collection([{ a: 'a' }, { b: 'b' }, { c: 'c' }]);
        assert.equal(collection.shift().get('a'), 'a');
        assert.equal(collection.pop().get('c'), 'c');
    });

    it('slice', function () {
        // assert.expect(2);
        var collection = new timeforce.Collection([{ a: 'a' }, { b: 'b' }, { c: 'c' }]);
        var array = collection.slice(1, 3);
        assert.equal(array.length, 2);
        assert.equal(array[0].get('b'), 'b');
    });

    it('events are unbound on remove', function () {
        // assert.expect(3);
        var counter = 0;
        var dj = new timeforce.Model();
        var emcees = new timeforce.Collection([dj]);
        emcees.on('change', function () { counter++; });
        dj.set({ name: 'Kool' });
        assert.equal(counter, 1);
        emcees.reset([]);
        assert.equal(dj.collection, undefined);
        dj.set({ name: 'Shadow' });
        assert.equal(counter, 1);
    });

    it('remove in multiple collections', function () {
        // assert.expect(7);
        var modelData = {
            id: 5,
            title: 'Othello'
        };
        var passed = false;
        var m1 = new timeforce.Model(modelData);
        var m2 = new timeforce.Model(modelData);
        m2.on('remove', function () {
            passed = true;
        });
        var col1 = new timeforce.Collection([m1]);
        var col2 = new timeforce.Collection([m2]);
        assert.notEqual(m1, m2);
        assert.ok(col1.length === 1);
        assert.ok(col2.length === 1);
        col1.remove(m1);
        assert.equal(passed, false);
        assert.ok(col1.length === 0);
        col2.remove(m1);
        assert.ok(col2.length === 0);
        assert.equal(passed, true);
    });

    it('remove same model in multiple collection', function () {
        // assert.expect(16);
        var counter = 0;
        var m = new timeforce.Model({ id: 5, title: 'Othello' });
        m.on('remove', function (model, collection) {
            counter++;
            assert.equal(m, model);
            if (counter > 1) {
                assert.equal(collection, col1);
            } else {
                assert.equal(collection, col2);
            }
        });
        var col1 = new timeforce.Collection([m]);
        col1.on('remove', function (model, collection) {
            assert.equal(m, model);
            assert.equal(col1, collection);
        });
        var col2 = new timeforce.Collection([m]);
        col2.on('remove', function (model, collection) {
            assert.equal(m, model);
            assert.equal(col2, collection);
        });
        assert.equal(col1, m.collection);
        col2.remove(m);
        assert.ok(col2.length === 0);
        assert.ok(col1.length === 1);
        assert.equal(counter, 1);
        assert.equal(col1, m.collection);
        col1.remove(m);
        assert.equal(null, m.collection);
        assert.ok(col1.length === 0);
        assert.equal(counter, 2);
    });

    it('model destroy removes from all collections', function () {
        // assert.expect(3);
        var m = new timeforce.Model({ id: 5, title: 'Othello' });
        m.sync = function (method, model, options) { options.success(); };
        var col1 = new timeforce.Collection([m]);
        var col2 = new timeforce.Collection([m]);
        m.destroy();
        assert.ok(col1.length === 0);
        assert.ok(col2.length === 0);
        assert.equal(undefined, m.collection);
    });

    it('Collection: non-persisted model destroy removes from all collections', function () {
        // assert.expect(3);
        var m = new timeforce.Model({ title: 'Othello' });
        m.sync = function (method, model, options) { throw 'should not be called'; };
        var col1 = new timeforce.Collection([m]);
        var col2 = new timeforce.Collection([m]);
        m.destroy();
        assert.ok(col1.length === 0);
        assert.ok(col2.length === 0);
        assert.equal(undefined, m.collection);
    });

    it('fetch', function () {
        // assert.expect(4);
        var collection = new timeforce.Collection;
        collection.url = '/test';
        collection.fetch();
        assert.equal(env.syncArgs.method, 'read');
        assert.equal(env.syncArgs.model, collection);
        assert.equal(env.syncArgs.options.parse, true);

        collection.fetch({ parse: false });
        assert.equal(env.syncArgs.options.parse, false);
    });

    it('fetch with an error response triggers an error event', function () {
        // assert.expect(1);
        var collection = new timeforce.Collection();
        collection.on('error', function () {
            assert.ok(true);
        });
        collection.sync = function (method, model, options) { options.error(); };
        collection.fetch();
    });

    it('#3283 - fetch with an error response calls error with context', function () {
        // assert.expect(1);
        var collection = new timeforce.Collection();
        var obj = {};
        var options = {
            context: obj,
            error: function () {
                assert.equal(this, obj);
            }
        };
        collection.sync = function (method, model, opts) {
            opts.error.call(opts.context);
        };
        collection.fetch(options);
    });

    it('ensure fetch only parses once', function () {
        // assert.expect(1);
        var collection = new timeforce.Collection;
        var counter = 0;
        collection.parse = function (models) {
            counter++;
            return models;
        };
        collection.url = '/test';
        collection.fetch();
        env.syncArgs.options.success([]);
        assert.equal(counter, 1);
    });

    it('create', function () {
        // assert.expect(4);
        var collection = new timeforce.Collection;
        collection.url = '/test';
        var model = collection.create({ label: 'f' }, { wait: true });
        assert.equal(env.syncArgs.method, 'create');
        assert.equal(env.syncArgs.model, model);
        assert.equal(model.get('label'), 'f');
        assert.equal(model.collection, collection);
    });

    it('create with validate:true enforces validation', function () {
        // assert.expect(3);
        var ValidatingModel = timeforce.Model.extend({
            validate: function (attrs) {
                return 'fail';
            }
        });
        var ValidatingCollection = timeforce.Collection.extend({
            model: ValidatingModel
        });
        var collection = new ValidatingCollection();
        collection.on('invalid', function (coll, error, options) {
            assert.equal(error, 'fail');
            assert.equal(options.validationError, 'fail');
        });
        assert.equal(collection.create({ foo: 'bar' }, { validate: true }), false);
    });

    it('create will pass extra options to success callback', function () {
        // assert.expect(1);
        var Model = timeforce.Model.extend({
            sync: function (method, model, options) {
                _.extend(options, { specialSync: true });
                return timeforce.Model.prototype.sync.call(this, method, model, options);
            }
        });

        var Collection = timeforce.Collection.extend({
            model: Model,
            url: '/test'
        });

        var collection = new Collection;

        var success = function (model, response, options) {
            assert.ok(options.specialSync, 'Options were passed correctly to callback');
        };

        collection.create({}, { success: success });
        env.persistSettings.success();
    });

    it('create with wait:true should not call collection.parse', function () {
        // assert.expect(0);
        var Collection = timeforce.Collection.extend({
            url: '/test',
            parse: function () {
                assert.ok(false);
            }
        });

        var collection = new Collection;

        collection.create({}, { wait: true });
        env.persistSettings.success();
    });

    it('a failing create returns model with errors', function () {
        var ValidatingModel = timeforce.Model.extend({
            validate: function (attrs) {
                return 'fail';
            }
        });
        var ValidatingCollection = timeforce.Collection.extend({
            model: ValidatingModel
        });
        var collection = new ValidatingCollection();
        var m = collection.create({ foo: 'bar' });
        assert.equal(m.validationError, 'fail');
        assert.equal(collection.length, 1);
    });

    it('initialize', function () {
        // assert.expect(1);
        var Collection = timeforce.Collection.extend({
            initialize: function () {
                this.one = 1;
            }
        });
        var coll = new Collection;
        assert.equal(coll.one, 1);
    });

    it('preinitialize', function () {
        // assert.expect(1);
        var Collection = timeforce.Collection.extend({
            preinitialize: function () {
                this.one = 1;
            }
        });
        var coll = new Collection;
        assert.equal(coll.one, 1);
    });

    it('preinitialize occurs before the collection is set up', function () {
        // assert.expect(2);
        var Collection = timeforce.Collection.extend({
            preinitialize: function () {
                assert.notEqual(this.model, FooModel);
            }
        });
        var FooModel = timeforce.Model.extend({ id: 'foo' });
        var coll = new Collection({}, {
            model: FooModel
        });
        assert.equal(coll.model, FooModel);
    });

    it('toJSON', function () {
        // assert.expect(1);
        assert.equal(JSON.stringify(col), '[{"id":3,"label":"a"},{"id":2,"label":"b"},{"id":1,"label":"c"},{"id":0,"label":"d"}]');
    });

    it('where and findWhere', function () {
        // assert.expect(8);
        var model = new timeforce.Model({ a: 1 });
        var coll = new timeforce.Collection([
            model,
            { a: 1 },
            { a: 1, b: 2 },
            { a: 2, b: 2 },
            { a: 3 }
        ]);
        assert.equal(coll.where({ a: 1 }).length, 3);
        assert.equal(coll.where({ a: 2 }).length, 1);
        assert.equal(coll.where({ a: 3 }).length, 1);
        assert.equal(coll.where({ b: 1 }).length, 0);
        assert.equal(coll.where({ b: 2 }).length, 2);
        assert.equal(coll.where({ a: 1, b: 2 }).length, 1);
        assert.equal(coll.findWhere({ a: 1 }), model);
        assert.equal(coll.findWhere({ a: 4 }), void 0);
    });

    it('mixin', function () {
        timeforce.Collection.mixin({
            sum: function (models, iteratee) {
                return _.reduce(models, function (s, m) {
                    return s + iteratee(m);
                }, 0);
            }
        });

        var coll = new timeforce.Collection([
            { a: 1 },
            { a: 1, b: 2 },
            { a: 2, b: 2 },
            { a: 3 }
        ]);

        assert.equal(coll.sum(function (m) {
            return m.get('a');
        }), 7);
    });

    it('Lodash methods', function () {
        // assert.expect(21);
        assert.equal(col.map(function (model) { return model.get('label'); }).join(' '), 'a b c d');
        assert.equal(col.some(function (model) { return model.id === 100; }), false);
        assert.equal(col.some(function (model) { return model.id === 0; }), true);
        assert.equal(col.reduce(function (m1, m2) { return m1.id > m2.id ? m1 : m2; }).id, 3);
        assert.equal(col.reduceRight(function (m1, m2) { return m1.id > m2.id ? m1 : m2; }).id, 3);
        assert.equal(col.indexOf(b), 1);
        assert.equal(col.size(), 4);

        assert.equal(col.takeRight(col.models.length - 1).length, 3);
        assert.ok(!_.includes(col.takeRight(col.models.length - 1), a));
        assert.ok(_.includes(col.takeRight(col.models.length - 1), d));
        assert.ok(!col.isEmpty());
        assert.ok(!_.includes(col.without(d), d));

        var wrapped = col.chain();
        assert.equal(wrapped.map('id').max().value(), 3);
        assert.equal(wrapped.map('id').min().value(), 0);
        assert.deepEqual(
            wrapped
                .filter(function (o) { return o.id % 2 === 0; })
                .map(function (o) { return o.id * 2; })
                .value(),
            [4, 0]
        );
        assert.deepEqual(col.difference([c, d]), [a, b]);
        assert.ok(col.includes(col.sample()));

        var first = col.first();
        assert.deepEqual(col.groupBy(function (model) { return model.id; })[first.id], [first]);
        assert.deepEqual(col.countBy(function (model) { return model.id; }), { 0: 1, 1: 1, 2: 1, 3: 1 });
        assert.deepEqual(col.sortBy(function (model) { return model.id; })[0], col.at(3));
        assert.ok(col.mapKeys('id')[first.id] === first);
    });

    it('Lodash methods with object-style and property-style iteratee', function () {
        // assert.expect(26);
        var model = new timeforce.Model({ a: 4, b: 1, e: 3 });
        var coll = new timeforce.Collection([
            { a: 1, b: 1 },
            { a: 2, b: 1, c: 1 },
            { a: 3, b: 1 },
            model
        ]);
        assert.equal(coll.find({ a: 0 }), undefined);
        assert.deepEqual(coll.find({ a: 4 }), model);
        assert.equal(coll.find('d'), undefined);
        assert.deepEqual(coll.find('e'), model);
        assert.equal(coll.filter({ a: 0 }), false);
        assert.deepEqual(coll.filter({ a: 4 }), [model]);
        assert.equal(coll.some({ a: 0 }), false);
        assert.equal(coll.some({ a: 1 }), true);
        assert.equal(coll.reject({ a: 0 }).length, 4);
        assert.deepEqual(coll.reject({ a: 4 }), _.without(coll.models, model));
        assert.equal(coll.every({ a: 0 }), false);
        assert.equal(coll.every({ b: 1 }), true);
        assert.deepEqual(coll.partition({ a: 0 })[0], []);
        assert.deepEqual(coll.partition({ a: 0 })[1], coll.models);
        assert.deepEqual(coll.partition({ a: 4 })[0], [model]);
        assert.deepEqual(coll.partition({ a: 4 })[1], _.without(coll.models, model));
        assert.deepEqual(coll.map({ a: 2 }), [false, true, false, false]);
        assert.deepEqual(coll.map('a'), [1, 2, 3, 4]);
        assert.deepEqual(coll.sortBy('a')[3], model);
        assert.deepEqual(coll.sortBy('e')[0], model);
        assert.deepEqual(coll.countBy({ a: 4 }), { 'false': 3, 'true': 1 });
        assert.deepEqual(coll.countBy('d'), { undefined: 4 });
        assert.equal(coll.findIndex({ b: 1 }), 0);
        assert.equal(coll.findIndex({ b: 9 }), -1);
        assert.equal(coll.findLastIndex({ b: 1 }), 3);
        assert.equal(coll.findLastIndex({ b: 9 }), -1);
    });

    it('reset', function () {
        // assert.expect(16);

        var resetCount = 0;
        var models = col.models;
        col.on('reset', function () { resetCount += 1; });
        col.reset([]);
        assert.equal(resetCount, 1);
        assert.equal(col.length, 0);
        assert.equal(col.last(), null);
        col.reset(models);
        assert.equal(resetCount, 2);
        assert.equal(col.length, 4);
        assert.equal(col.last(), d);
        col.reset(_.map(models, function (m) { return m.attributes; }));
        assert.equal(resetCount, 3);
        assert.equal(col.length, 4);
        assert.ok(col.last() !== d);
        assert.ok(_.isEqual(col.last().attributes, d.attributes));
        col.reset();
        assert.equal(col.length, 0);
        assert.equal(resetCount, 4);

        var f = new timeforce.Model({ id: 20, label: 'f' });
        col.reset([undefined, f]);
        assert.equal(col.length, 2);
        assert.equal(resetCount, 5);

        col.reset(new Array(4));
        assert.equal(col.length, 4);
        assert.equal(resetCount, 6);
    });

    it('reset with different values', function () {
        var collection = new timeforce.Collection({ id: 1 });
        collection.reset({ id: 1, a: 1 });
        assert.equal(collection.get(1).get('a'), 1);
    });

    it('same references in reset', function () {
        var model = new timeforce.Model({ id: 1 });
        var collection = new timeforce.Collection({ id: 1 });
        collection.reset(model);
        assert.equal(collection.get(1), model);
    });

    it('reset passes caller options', function () {
        // assert.expect(3);
        var Model = timeforce.Model.extend({
            initialize: function (attrs, options) {
                this.modelParameter = options.modelParameter;
            }
        });
        var collection = new (timeforce.Collection.extend({ model: Model }))();
        collection.reset([{ astring: 'green', anumber: 1 }, { astring: 'blue', anumber: 2 }], { modelParameter: 'model parameter' });
        assert.equal(collection.length, 2);
        collection.each(function (model) {
            assert.equal(model.modelParameter, 'model parameter');
        });
    });

    it('reset does not alter options by reference', function () {
        // assert.expect(2);
        var collection = new timeforce.Collection([{ id: 1 }]);
        var origOpts = {};
        collection.on('reset', function (coll, opts) {
            assert.equal(origOpts.previousModels, undefined);
            assert.equal(opts.previousModels[0].id, 1);
        });
        collection.reset([], origOpts);
    });

    it('trigger custom events on models', function () {
        // assert.expect(1);
        var fired = null;
        a.on('custom', function () { fired = true; });
        a.trigger('custom');
        assert.equal(fired, true);
    });

    it('add does not alter arguments', function () {
        // assert.expect(2);
        var attrs = {};
        var models = [attrs];
        new timeforce.Collection().add(models);
        assert.equal(models.length, 1);
        assert.ok(attrs === models[0]);
    });

    it('#714: access `model.collection` in a brand new model.', function () {
        // assert.expect(2);
        var collection = new timeforce.Collection;
        collection.url = '/test';
        var Model = timeforce.Model.extend({
            set: function (attrs) {
                assert.equal(attrs.prop, 'value');
                assert.equal(this.collection, collection);
                return this;
            }
        });
        collection.model = Model;
        collection.create({ prop: 'value' });
    });

    it('#574, remove its own reference to the .models array.', function () {
        // assert.expect(2);
        var collection = new timeforce.Collection([
            { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }
        ]);
        assert.equal(collection.length, 6);
        collection.remove(collection.models);
        assert.equal(collection.length, 0);
    });

    it('#861, adding models to a collection which do not pass validation, with validate:true', function () {
        // assert.expect(2);
        var Model = timeforce.Model.extend({
            validate: function (attrs) {
                if (attrs.id === 3) return "id can't be 3";
            }
        });

        var Collection = timeforce.Collection.extend({
            model: Model
        });

        var collection = new Collection;
        collection.on('invalid', function () { assert.ok(true); });

        collection.add([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }], { validate: true });
        assert.deepEqual(collection.pluck('id'), [1, 2, 4, 5, 6]);
    });

    it('Invalid models are discarded with validate:true.', function () {
        // assert.expect(5);
        var collection = new timeforce.Collection;
        collection.on('test', function () { assert.ok(true); });
        collection.model = timeforce.Model.extend({
            validate: function (attrs) { if (!attrs.valid) return 'invalid'; }
        });
        var model = new collection.model({ id: 1, valid: true });
        collection.add([model, { id: 2 }], { validate: true });
        model.trigger('test');
        assert.ok(collection.get(model.cid));
        assert.ok(collection.get(1));
        assert.ok(!collection.get(2));
        assert.equal(collection.length, 1);
    });

    it('multiple copies of the same model', function () {
        // assert.expect(3);
        var collection = new timeforce.Collection();
        var model = new timeforce.Model();
        collection.add([model, model]);
        assert.equal(collection.length, 1);
        collection.add([{ id: 1 }, { id: 1 }]);
        assert.equal(collection.length, 2);
        assert.equal(collection.last().id, 1);
    });

    it('#964 - collection.get return inconsistent', function () {
        // assert.expect(2);
        var collection = new timeforce.Collection();
        assert.ok(collection.get(null) === undefined);
        assert.ok(collection.get() === undefined);
    });

    it('#1112 - passing options.model sets collection.model', function () {
        // assert.expect(2);
        var Model = timeforce.Model.extend({});
        var collection = new timeforce.Collection([{ id: 1 }], { model: Model });
        assert.ok(collection.model === Model);
        assert.ok(collection.at(0) instanceof Model);
    });

    it('null and undefined are invalid ids.', function () {
        // assert.expect(2);
        var model = new timeforce.Model({ id: 1 });
        var collection = new timeforce.Collection([model]);
        model.set({ id: null });
        assert.ok(!collection.get('null'));
        model.set({ id: 1 });
        model.set({ id: undefined });
        assert.ok(!collection.get('undefined'));
    });

    it('falsy comparator', function () {
        // assert.expect(4);
        var Col = timeforce.Collection.extend({
            comparator: function (model) { return model.id; }
        });
        var collection = new Col();
        var colFalse = new Col(null, { comparator: false });
        var colNull = new Col(null, { comparator: null });
        var colUndefined = new Col(null, { comparator: undefined });
        assert.ok(collection.comparator);
        assert.ok(!colFalse.comparator);
        assert.ok(!colNull.comparator);
        assert.ok(colUndefined.comparator);
    });

    it('#1355 - `options` is passed to success callbacks', function () {
        // assert.expect(2);
        var m = new timeforce.Model({ x: 1 });
        var collection = new timeforce.Collection();
        var opts = {
            opts: true,
            success: function (coll, resp, options) {
                assert.ok(options.opts);
            }
        };
        collection.sync = m.sync = function (method, coll, options) {
            options.success({});
        };
        collection.fetch(opts);
        collection.create(m, opts);
    });

    it("#1412 - Trigger 'request' and 'sync' events.", function () {
        // assert.expect(4);
        var collection = new timeforce.Collection;
        collection.url = '/test';
        timeforce.ajax = function (settings) { settings.success(); };

        collection.on('request', function (obj, xhr, options) {
            assert.ok(obj === collection, "collection has correct 'request' event after fetching");
        });
        collection.on('sync', function (obj, response, options) {
            assert.ok(obj === collection, "collection has correct 'sync' event after fetching");
        });
        collection.fetch();
        collection.off();

        collection.on('request', function (obj, xhr, options) {
            assert.ok(obj === collection.get(1), "collection has correct 'request' event after one of its models save");
        });
        collection.on('sync', function (obj, response, options) {
            assert.ok(obj === collection.get(1), "collection has correct 'sync' event after one of its models save");
        });
        collection.create({ id: 1 });
        collection.off();
    });

    it('#3283 - fetch, create calls success with context', function () {
        // assert.expect(2);
        var collection = new timeforce.Collection;
        collection.url = '/test';
        timeforce.ajax = function (settings) {
            settings.success.call(settings.context);
        };
        var obj = {};
        var options = {
            context: obj,
            success: function () {
                assert.equal(this, obj);
            }
        };

        collection.fetch(options);
        collection.create({ id: 1 }, options);
    });

    it('#1447 - create with wait adds model.', function () {
        // assert.expect(1);
        var collection = new timeforce.Collection;
        var model = new timeforce.Model;
        model.sync = function (method, m, options) { options.success(); };
        collection.on('add', function () { assert.ok(true); });
        collection.create(model, { wait: true });
    });

    it('#1448 - add sorts collection after merge.', function () {
        // assert.expect(1);
        var collection = new timeforce.Collection([
            { id: 1, x: 1 },
            { id: 2, x: 2 }
        ]);
        collection.comparator = function (model) { return model.get('x'); };
        collection.add({ id: 1, x: 3 }, { merge: true });
        assert.deepEqual(collection.pluck('id'), [2, 1]);
    });

    it('#1655 - groupBy can be used with a string argument.', function () {
        // assert.expect(3);
        var collection = new timeforce.Collection([{ x: 1 }, { x: 2 }]);
        var grouped = collection.groupBy('x');
        assert.strictEqual(_.keys(grouped).length, 2);
        assert.strictEqual(grouped[1][0].get('x'), 1);
        assert.strictEqual(grouped[2][0].get('x'), 2);
    });

    it('#1655 - sortBy can be used with a string argument.', function () {
        // assert.expect(1);
        var collection = new timeforce.Collection([{ x: 3 }, { x: 1 }, { x: 2 }]);
        var values = _.map(collection.sortBy('x'), function (model) {
            return model.get('x');
        });
        assert.deepEqual(values, [1, 2, 3]);
    });

    it('#1604 - Removal during iteration.', function () {
        // assert.expect(0);
        var collection = new timeforce.Collection([{}, {}]);
        collection.on('add', function () {
            collection.at(0).destroy();
        });
        collection.add({}, { at: 0 });
    });

    it('#1638 - `sort` during `add` triggers correctly.', function () {
        var collection = new timeforce.Collection;
        collection.comparator = function (model) { return model.get('x'); };
        var added = [];
        collection.on('add', function (model) {
            model.set({ x: 3 });
            collection.sort();
            added.push(model.id);
        });
        collection.add([{ id: 1, x: 1 }, { id: 2, x: 2 }]);
        assert.deepEqual(added, [1, 2]);
    });

    it('fetch parses models by default', function () {
        // assert.expect(1);
        var model = {};
        var Collection = timeforce.Collection.extend({
            url: 'test',
            model: timeforce.Model.extend({
                parse: function (resp) {
                    assert.strictEqual(resp, model);
                }
            })
        });
        new Collection().fetch();
        env.persistSettings.success([model]);
    });

    it("`sort` shouldn't always fire on `add`", function () {
        // assert.expect(1);
        var collection = new timeforce.Collection([{ id: 1 }, { id: 2 }, { id: 3 }], {
            comparator: 'id'
        });
        collection.sort = function () { assert.ok(true); };
        collection.add([]);
        collection.add({ id: 1 });
        collection.add([{ id: 2 }, { id: 3 }]);
        collection.add({ id: 4 });
    });

    it('#1407 parse option on constructor parses collection and models', function () {
        // assert.expect(2);
        var model = {
            namespace: [{ id: 1 }, { id: 2 }]
        };
        var Collection = timeforce.Collection.extend({
            model: timeforce.Model.extend({
                parse: function (m) {
                    m.name = 'test';
                    return m;
                }
            }),
            parse: function (m) {
                return m.namespace;
            }
        });
        var collection = new Collection(model, { parse: true });

        assert.equal(collection.length, 2);
        assert.equal(collection.at(0).get('name'), 'test');
    });

    it('#1407 parse option on reset parses collection and models', function () {
        // assert.expect(2);
        var model = {
            namespace: [{ id: 1 }, { id: 2 }]
        };
        var Collection = timeforce.Collection.extend({
            model: timeforce.Model.extend({
                parse: function (m) {
                    m.name = 'test';
                    return m;
                }
            }),
            parse: function (m) {
                return m.namespace;
            }
        });
        var collection = new Collection();
        collection.reset(model, { parse: true });

        assert.equal(collection.length, 2);
        assert.equal(collection.at(0).get('name'), 'test');
    });


    it('Reset includes previous models in triggered event.', function () {
        // assert.expect(1);
        var model = new timeforce.Model();
        var collection = new timeforce.Collection([model]);
        collection.on('reset', function (coll, options) {
            assert.deepEqual(options.previousModels, [model]);
        });
        collection.reset([]);
    });

    it('set', function () {
        var m1 = new timeforce.Model();
        var m2 = new timeforce.Model({ id: 2 });
        var m3 = new timeforce.Model();
        var collection = new timeforce.Collection([m1, m2]);

        // Test add/change/remove events
        collection.on('add', function (model) {
            assert.strictEqual(model, m3);
        });
        collection.on('change', function (model) {
            assert.strictEqual(model, m2);
        });
        collection.on('remove', function (model) {
            assert.strictEqual(model, m1);
        });

        // remove: false doesn't remove any models
        collection.set([], { remove: false });
        assert.strictEqual(collection.length, 2);

        // add: false doesn't add any models
        collection.set([m1, m2, m3], { add: false });
        assert.strictEqual(collection.length, 2);

        // merge: false doesn't change any models
        collection.set([m1, { id: 2, a: 1 }], { merge: false });
        assert.strictEqual(m2.get('a'), void 0);

        // add: false, remove: false only merges existing models
        collection.set([m1, { id: 2, a: 0 }, m3, { id: 4 }], { add: false, remove: false });
        assert.strictEqual(collection.length, 2);
        assert.strictEqual(m2.get('a'), 0);

        // default options add/remove/merge as appropriate
        collection.set([{ id: 2, a: 1 }, m3]);
        assert.strictEqual(collection.length, 2);
        assert.strictEqual(m2.get('a'), 1);

        // Test removing models not passing an argument
        collection.off('remove').on('remove', function (model) {
            assert.ok(model === m2 || model === m3);
        });
        collection.set([]);
        assert.strictEqual(collection.length, 0);

        // Test null models on set doesn't clear collection
        collection.off();
        collection.set([{ id: 1 }]);
        collection.set();
        assert.strictEqual(collection.length, 1);
    });

    it('set with only cids', function () {
        // assert.expect(3);
        var m1 = new timeforce.Model;
        var m2 = new timeforce.Model;
        var collection = new timeforce.Collection;
        collection.set([m1, m2]);
        assert.equal(collection.length, 2);
        collection.set([m1]);
        assert.equal(collection.length, 1);
        collection.set([m1, m1, m1, m2, m2], { remove: false });
        assert.equal(collection.length, 2);
    });

    it('set with only idAttribute', function () {
        // assert.expect(3);
        var m1 = { _id: 1 };
        var m2 = { _id: 2 };
        var Col = timeforce.Collection.extend({
            model: timeforce.Model.extend({
                idAttribute: '_id'
            })
        });
        var collection = new Col;
        collection.set([m1, m2]);
        assert.equal(collection.length, 2);
        collection.set([m1]);
        assert.equal(collection.length, 1);
        collection.set([m1, m1, m1, m2, m2], { remove: false });
        assert.equal(collection.length, 2);
    });

    it('set + merge with default values defined', function () {
        var Model = timeforce.Model.extend({
            defaults: {
                key: 'value'
            }
        });
        var m = new Model({ id: 1 });
        var collection = new timeforce.Collection([m], { model: Model });
        assert.equal(collection.first().get('key'), 'value');

        collection.set({ id: 1, key: 'other' });
        assert.equal(collection.first().get('key'), 'other');

        collection.set({ id: 1, other: 'value' });
        assert.equal(collection.first().get('key'), 'other');
        assert.equal(collection.length, 1);
    });

    it('merge without mutation', function () {
        var Model = timeforce.Model.extend({
            initialize: function (attrs, options) {
                if (attrs.child) {
                    this.set('child', new Model(attrs.child, options), options);
                }
            }
        });
        var Collection = timeforce.Collection.extend({ model: Model });
        var data = [{ id: 1, child: { id: 2 } }];
        var collection = new Collection(data);
        assert.equal(collection.first().id, 1);
        collection.set(data);
        assert.equal(collection.first().id, 1);
        collection.set([{ id: 2, child: { id: 2 } }].concat(data));
        assert.deepEqual(collection.pluck('id'), [2, 1]);
    });

    it('`set` and model level `parse`', function () {
        var Model = timeforce.Model.extend({});
        var Collection = timeforce.Collection.extend({
            model: Model,
            parse: function (res) { return _.map(res.models, 'model'); }
        });
        var model = new Model({ id: 1 });
        var collection = new Collection(model);
        collection.set({
            models: [
                { model: { id: 1 } },
                { model: { id: 2 } }
            ]
        }, { parse: true });
        assert.equal(collection.first(), model);
    });

    it('`set` data is only parsed once', function () {
        var collection = new timeforce.Collection();
        collection.model = timeforce.Model.extend({
            parse: function (data) {
                assert.equal(data.parsed, void 0);
                data.parsed = true;
                return data;
            }
        });
        collection.set({}, { parse: true });
    });

    it('`set` matches input order in the absence of a comparator', function () {
        var one = new timeforce.Model({ id: 1 });
        var two = new timeforce.Model({ id: 2 });
        var three = new timeforce.Model({ id: 3 });
        var collection = new timeforce.Collection([one, two, three]);
        collection.set([{ id: 3 }, { id: 2 }, { id: 1 }]);
        assert.deepEqual(collection.models, [three, two, one]);
        collection.set([{ id: 1 }, { id: 2 }]);
        assert.deepEqual(collection.models, [one, two]);
        collection.set([two, three, one]);
        assert.deepEqual(collection.models, [two, three, one]);
        collection.set([{ id: 1 }, { id: 2 }], { remove: false });
        assert.deepEqual(collection.models, [two, three, one]);
        collection.set([{ id: 1 }, { id: 2 }, { id: 3 }], { merge: false });
        assert.deepEqual(collection.models, [one, two, three]);
        collection.set([three, two, one, { id: 4 }], { add: false });
        assert.deepEqual(collection.models, [one, two, three]);
    });

    it('#1894 - Push should not trigger a sort', function () {
        // assert.expect(0);
        var Collection = timeforce.Collection.extend({
            comparator: 'id',
            sort: function () { assert.ok(false); }
        });
        new Collection().push({ id: 1 });
    });

    it('#2428 - push duplicate models, return the correct one', function () {
        // assert.expect(1);
        var collection = new timeforce.Collection;
        var model1 = collection.push({ id: 101 });
        var model2 = collection.push({ id: 101 });
        assert.ok(model2.cid === model1.cid);
    });

    it('`set` with non-normal id', function () {
        var Collection = timeforce.Collection.extend({
            model: timeforce.Model.extend({ idAttribute: '_id' })
        });
        var collection = new Collection({ _id: 1 });
        collection.set([{ _id: 1, a: 1 }], { add: false });
        assert.equal(collection.first().get('a'), 1);
    });

    it('#1894 - `sort` can optionally be turned off', function () {
        // assert.expect(0);
        var Collection = timeforce.Collection.extend({
            comparator: 'id',
            sort: function () { assert.ok(false); }
        });
        new Collection().add({ id: 1 }, { sort: false });
    });

    it('#1915 - `parse` data in the right order in `set`', function () {
        var collection = new (timeforce.Collection.extend({
            parse: function (data) {
                assert.strictEqual(data.status, 'ok');
                return data.data;
            }
        }));
        var res = { status: 'ok', data: [{ id: 1 }] };
        collection.set(res, { parse: true });
    });

    it('#1939 - `parse` is passed `options`', function (done) {
        // assert.expect(1);
        var collection = new (timeforce.Collection.extend({
            url: '/',
            parse: function (data, options) {
                assert.equal(options.parse, true);
                return data;
            }
        }));
        var persist = timeforce.persist;
        timeforce.persist = function (options, config) {
            return new Promise((resolve) => {
                options.success({});
                resolve({});
            });
        };
        collection.fetch({
            success: function () { done(); }
        });
        timeforce.persist = persist;
    });

    it('fetch will pass extra options to success callback', function (done) {
        // assert.expect(1);
        var SpecialSyncCollection = timeforce.Collection.extend({
            url: '/test',
            sync: function (method, collection, options) {
                _.extend(options, { specialSync: true });
                return timeforce.Collection.prototype.sync.call(this, method, collection, options);
            }
        });

        var collection = new SpecialSyncCollection();

        var onSuccess = function (coll, resp, options) {
            assert.ok(options.specialSync, 'Options were passed correctly to callback');
            done();
        };

        collection.fetch({ success: onSuccess });
        env.persistSettings.success();
    });

    it('`add` only `sort`s when necessary', function () {
        // assert.expect(2);
        var collection = new (timeforce.Collection.extend({
            comparator: 'a'
        }))([{ id: 1 }, { id: 2 }, { id: 3 }]);
        collection.on('sort', function () { assert.ok(true); });
        collection.add({ id: 4 }); // do sort, new model
        collection.add({ id: 1, a: 1 }, { merge: true }); // do sort, comparator change
        collection.add({ id: 1, b: 1 }, { merge: true }); // don't sort, no comparator change
        collection.add({ id: 1, a: 1 }, { merge: true }); // don't sort, no comparator change
        collection.add(collection.models); // don't sort, nothing new
        collection.add(collection.models, { merge: true }); // don't sort
    });

    it('`add` only `sort`s when necessary with comparator function', function () {
        // assert.expect(3);
        var collection = new (timeforce.Collection.extend({
            comparator: function (m1, m2) {
                return m1.get('a') > m2.get('a') ? 1 : m1.get('a') < m2.get('a') ? -1 : 0;
            }
        }))([{ id: 1 }, { id: 2 }, { id: 3 }]);
        collection.on('sort', function () { assert.ok(true); });
        collection.add({ id: 4 }); // do sort, new model
        collection.add({ id: 1, a: 1 }, { merge: true }); // do sort, model change
        collection.add({ id: 1, b: 1 }, { merge: true }); // do sort, model change
        collection.add({ id: 1, a: 1 }, { merge: true }); // don't sort, no model change
        collection.add(collection.models); // don't sort, nothing new
        collection.add(collection.models, { merge: true }); // don't sort
    });

    it('Attach options to collection.', function () {
        // assert.expect(2);
        var Model = timeforce.Model;
        var comparator = function () { };

        var collection = new timeforce.Collection([], {
            model: Model,
            comparator: comparator
        });

        assert.ok(collection.model === Model);
        assert.ok(collection.comparator === comparator);
    });

    it('Pass falsey for `models` for empty Col with `options`', function () {
        // assert.expect(9);
        var opts = { a: 1, b: 2 };
        _.forEach([undefined, null, false], function (falsey) {
            var Collection = timeforce.Collection.extend({
                initialize: function (models, options) {
                    assert.strictEqual(models, falsey);
                    assert.strictEqual(options, opts);
                }
            });

            var collection = new Collection(falsey, opts);
            assert.strictEqual(collection.length, 0);
        });
    });

    it('`add` overrides `set` flags', function () {
        var collection = new timeforce.Collection();
        collection.once('add', function (model, coll, options) {
            coll.add({ id: 2 }, options);
        });
        collection.set({ id: 1 });
        assert.equal(collection.length, 2);
    });

    it('#2606 - Collection#create, success arguments', function () {
        // assert.expect(1);
        var collection = new timeforce.Collection;
        collection.url = 'test';
        collection.create({}, {
            success: function (model, resp, options) {
                assert.strictEqual(resp, 'response');
            }
        });
        env.persistSettings.success('response');
    });

    it('#2612 - nested `parse` works with `Collection#set`', function () {

        var Job = timeforce.Model.extend({
            constructor: function () {
                this.items = new Items();
                timeforce.Model.apply(this, arguments);
            },
            parse: function (attrs) {
                this.items.set(attrs.items, { parse: true });
                return _.omit(attrs, 'items');
            }
        });

        var Item = timeforce.Model.extend({
            constructor: function () {
                this.subItems = new timeforce.Collection();
                timeforce.Model.apply(this, arguments);
            },
            parse: function (attrs) {
                this.subItems.set(attrs.subItems, { parse: true });
                return _.omit(attrs, 'subItems');
            }
        });

        var Items = timeforce.Collection.extend({
            model: Item
        });

        var data = {
            name: 'JobName',
            id: 1,
            items: [{
                id: 1,
                name: 'Sub1',
                subItems: [
                    { id: 1, subName: 'One' },
                    { id: 2, subName: 'Two' }
                ]
            }, {
                id: 2,
                name: 'Sub2',
                subItems: [
                    { id: 3, subName: 'Three' },
                    { id: 4, subName: 'Four' }
                ]
            }]
        };

        var newData = {
            name: 'NewJobName',
            id: 1,
            items: [{
                id: 1,
                name: 'NewSub1',
                subItems: [
                    { id: 1, subName: 'NewOne' },
                    { id: 2, subName: 'NewTwo' }
                ]
            }, {
                id: 2,
                name: 'NewSub2',
                subItems: [
                    { id: 3, subName: 'NewThree' },
                    { id: 4, subName: 'NewFour' }
                ]
            }]
        };

        var job = new Job(data, { parse: true });
        assert.equal(job.get('name'), 'JobName');
        assert.equal(job.items.at(0).get('name'), 'Sub1');
        assert.equal(job.items.length, 2);
        assert.equal(job.items.get(1).subItems.get(1).get('subName'), 'One');
        assert.equal(job.items.get(2).subItems.get(3).get('subName'), 'Three');
        job.set(job.parse(newData, { parse: true }));
        assert.equal(job.get('name'), 'NewJobName');
        assert.equal(job.items.at(0).get('name'), 'NewSub1');
        assert.equal(job.items.length, 2);
        assert.equal(job.items.get(1).subItems.get(1).get('subName'), 'NewOne');
        assert.equal(job.items.get(2).subItems.get(3).get('subName'), 'NewThree');
    });

    it('_addReference binds all collection events & adds to the lookup hashes', function () {
        // assert.expect(8);

        var calls = { add: 0, remove: 0 };

        var Collection = timeforce.Collection.extend({

            _addReference: function (model) {
                timeforce.Collection.prototype._addReference.apply(this, arguments);
                calls.add++;
                assert.equal(model, this._byId[model.id]);
                assert.equal(model, this._byId[model.cid]);
                assert.equal(model._events.all.length, 1);
            },

            _removeReference: function (model) {
                timeforce.Collection.prototype._removeReference.apply(this, arguments);
                calls.remove++;
                assert.equal(this._byId[model.id], void 0);
                assert.equal(this._byId[model.cid], void 0);
                assert.equal(model.collection, void 0);
            }

        });

        var collection = new Collection();
        var model = collection.add({ id: 1 });
        collection.remove(model);

        assert.equal(calls.add, 1);
        assert.equal(calls.remove, 1);
    });

    it('Do not allow duplicate models to be `add`ed or `set`', function () {
        var collection = new timeforce.Collection();

        collection.add([{ id: 1 }, { id: 1 }]);
        assert.equal(collection.length, 1);
        assert.equal(collection.models.length, 1);

        collection.set([{ id: 1 }, { id: 1 }]);
        assert.equal(collection.length, 1);
        assert.equal(collection.models.length, 1);
    });

    it('#3020: #set with {add: false} should not throw.', function () {
        // assert.expect(2);
        var collection = new timeforce.Collection;
        collection.set([{ id: 1 }], { add: false });
        assert.strictEqual(collection.length, 0);
        assert.strictEqual(collection.models.length, 0);
    });

    it('create with wait, model instance, #3028', function () {
        // assert.expect(1);
        var collection = new timeforce.Collection();
        var model = new timeforce.Model({ id: 1 });
        model.sync = function () {
            assert.equal(this.collection, collection);
        };
        collection.create(model, { wait: true });
    });

    it('modelId', function () {
        var Stooge = timeforce.Model.extend();
        var StoogeCollection = timeforce.Collection.extend();

        // Default to using `id` if `model::idAttribute` and `Collection::model::idAttribute` not present.
        assert.equal(StoogeCollection.prototype.modelId({ id: 1 }), 1);

        // Default to using `model::idAttribute` if present.
        Stooge.prototype.idAttribute = '_id';
        var model = new Stooge({ _id: 1 });
        assert.equal(StoogeCollection.prototype.modelId(model.attributes, model.idAttribute), 1);

        // Default to using `Collection::model::idAttribute` if model::idAttribute not present.
        StoogeCollection.prototype.model = Stooge;
        assert.equal(StoogeCollection.prototype.modelId({ _id: 1 }), 1);

    });

    it('Polymorphic models work with "simple" constructors', function () {
        var A = timeforce.Model.extend();
        var B = timeforce.Model.extend();
        var C = timeforce.Collection.extend({
            model: function (attrs) {
                return attrs.type === 'a' ? new A(attrs) : new B(attrs);
            }
        });
        var collection = new C([{ id: 1, type: 'a' }, { id: 2, type: 'b' }]);
        assert.equal(collection.length, 2);
        assert.ok(collection.at(0) instanceof A);
        assert.equal(collection.at(0).id, 1);
        assert.ok(collection.at(1) instanceof B);
        assert.equal(collection.at(1).id, 2);
    });

    it('Polymorphic models work with "advanced" constructors', function () {
        var A = timeforce.Model.extend({ idAttribute: '_id' });
        var B = timeforce.Model.extend({ idAttribute: '_id' });
        var C = timeforce.Collection.extend({
            model: timeforce.Model.extend({
                constructor: function (attrs) {
                    return attrs.type === 'a' ? new A(attrs) : new B(attrs);
                },

                idAttribute: '_id'
            })
        });
        var collection = new C([{ _id: 1, type: 'a' }, { _id: 2, type: 'b' }]);
        assert.equal(collection.length, 2);
        assert.ok(collection.at(0) instanceof A);
        assert.equal(collection.at(0), collection.get(1));
        assert.ok(collection.at(1) instanceof B);
        assert.equal(collection.at(1), collection.get(2));

        C = timeforce.Collection.extend({
            model: function (attrs) {
                return attrs.type === 'a' ? new A(attrs) : new B(attrs);
            },

            modelId: function (attrs) {
                return attrs.type + '-' + attrs.id;
            }
        });
        collection = new C([{ id: 1, type: 'a' }, { id: 1, type: 'b' }]);
        assert.equal(collection.length, 2);
        assert.ok(collection.at(0) instanceof A);
        assert.equal(collection.at(0), collection.get('a-1'));
        assert.ok(collection.at(1) instanceof B);
        assert.equal(collection.at(1), collection.get('b-1'));
    });

    it('Collection with polymorphic models receives id from modelId using model instance idAttribute', function () {
        // assert.expect(6);
        // When the polymorphic models use 'id' for the idAttribute, all is fine.
        var C1 = timeforce.Collection.extend({
            model: function (attrs) {
                return new timeforce.Model(attrs);
            }
        });
        var c1 = new C1({ id: 1 });
        assert.equal(c1.get(1).id, 1);
        assert.equal(c1.modelId({ id: 1 }), 1);

        // If the polymorphic models define their own idAttribute,
        // the modelId method will use the model's idAttribute property before the
        // collection's model constructor's.
        var M = timeforce.Model.extend({
            idAttribute: '_id'
        });
        var C2 = timeforce.Collection.extend({
            model: function (attrs) {
                return new M(attrs);
            }
        });
        var c2 = new C2({ _id: 1 });
        assert.equal(c2.get(1), c2.at(0));
        assert.equal(c2.modelId(c2.at(0).attributes, c2.at(0).idAttribute), 1);
        var m = new M({ _id: 2 });
        c2.add(m);
        assert.equal(c2.get(2), m);
        assert.equal(c2.modelId(m.attributes, m.idAttribute), 2);
    });

    it('Collection implements Iterable, values is default iterator function', function () {
        /* global Symbol */
        var $$iterator = typeof Symbol === 'function' && Symbol.iterator;
        // This test only applies to environments which define Symbol.iterator.
        if (!$$iterator) {
            // assert.expect(0);
            return;
        }
        // assert.expect(2);
        var collection = new timeforce.Collection([]);
        assert.strictEqual(collection[$$iterator], collection.values);
        var iterator = collection[$$iterator]();
        assert.deepEqual(iterator.next(), { value: void 0, done: true });
    });

    it('Collection.values iterates models in sorted order', function () {
        // assert.expect(4);
        var one = new timeforce.Model({ id: 1 });
        var two = new timeforce.Model({ id: 2 });
        var three = new timeforce.Model({ id: 3 });
        var collection = new timeforce.Collection([one, two, three]);
        var iterator = collection.values();
        assert.strictEqual(iterator.next().value, one);
        assert.strictEqual(iterator.next().value, two);
        assert.strictEqual(iterator.next().value, three);
        assert.strictEqual(iterator.next().value, void 0);
    });

    it('Collection.keys iterates ids in sorted order', function () {
        // assert.expect(4);
        var one = new timeforce.Model({ id: 1 });
        var two = new timeforce.Model({ id: 2 });
        var three = new timeforce.Model({ id: 3 });
        var collection = new timeforce.Collection([one, two, three]);
        var iterator = collection.keys();
        assert.strictEqual(iterator.next().value, 1);
        assert.strictEqual(iterator.next().value, 2);
        assert.strictEqual(iterator.next().value, 3);
        assert.strictEqual(iterator.next().value, void 0);
    });

    it('Collection.entries iterates ids and models in sorted order', function () {
        // assert.expect(4);
        var one = new timeforce.Model({ id: 1 });
        var two = new timeforce.Model({ id: 2 });
        var three = new timeforce.Model({ id: 3 });
        var collection = new timeforce.Collection([one, two, three]);
        var iterator = collection.entries();
        assert.deepEqual(iterator.next().value, [1, one]);
        assert.deepEqual(iterator.next().value, [2, two]);
        assert.deepEqual(iterator.next().value, [3, three]);
        assert.strictEqual(iterator.next().value, void 0);
    });

    it('#3039 #3951: adding at index fires with correct at', function () {
        // assert.expect(4);
        var collection = new timeforce.Collection([{ val: 0 }, { val: 4 }]);
        collection.on('add', function (model, coll, options) {
            assert.equal(model.get('val'), options.index);
        });
        collection.add([{ val: 1 }, { val: 2 }, { val: 3 }], { at: 1 });
        collection.add({ val: 5 }, { at: 10 });
    });

    it('#3039: index is not sent when at is not specified', function () {
        // assert.expect(2);
        var collection = new timeforce.Collection([{ at: 0 }]);
        collection.on('add', function (model, coll, options) {
            assert.equal(undefined, options.index);
        });
        collection.add([{ at: 1 }, { at: 2 }]);
    });

    it('#3199 - Order changing should trigger a sort', function () {
        // assert.expect(1);
        var one = new timeforce.Model({ id: 1 });
        var two = new timeforce.Model({ id: 2 });
        var three = new timeforce.Model({ id: 3 });
        var collection = new timeforce.Collection([one, two, three]);
        collection.on('sort', function () {
            assert.ok(true);
        });
        collection.set([{ id: 3 }, { id: 2 }, { id: 1 }]);
    });

    it('#3199 - Adding a model should trigger a sort', function () {
        // assert.expect(1);
        var one = new timeforce.Model({ id: 1 });
        var two = new timeforce.Model({ id: 2 });
        var three = new timeforce.Model({ id: 3 });
        var collection = new timeforce.Collection([one, two, three]);
        collection.on('sort', function () {
            assert.ok(true);
        });
        collection.set([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 0 }]);
    });

    it('#3199 - Order not changing should not trigger a sort', function () {
        // assert.expect(0);
        var one = new timeforce.Model({ id: 1 });
        var two = new timeforce.Model({ id: 2 });
        var three = new timeforce.Model({ id: 3 });
        var collection = new timeforce.Collection([one, two, three]);
        collection.on('sort', function () {
            assert.ok(false);
        });
        collection.set([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it('add supports negative indexes', function () {
        // assert.expect(1);
        var collection = new timeforce.Collection([{ id: 1 }]);
        collection.add([{ id: 2 }, { id: 3 }], { at: -1 });
        collection.add([{ id: 2.5 }], { at: -2 });
        collection.add([{ id: 0.5 }], { at: -6 });
        assert.equal(collection.pluck('id').join(','), '0.5,1,2,2.5,3');
    });

    it('#set accepts options.at as a string', function () {
        // assert.expect(1);
        var collection = new timeforce.Collection([{ id: 1 }, { id: 2 }]);
        collection.add([{ id: 3 }], { at: '1' });
        assert.deepEqual(collection.pluck('id'), [1, 3, 2]);
    });

    it('adding multiple models triggers `update` event once', function () {
        // assert.expect(1);
        var collection = new timeforce.Collection;
        collection.on('update', function () { assert.ok(true); });
        collection.add([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it('removing models triggers `update` event once', function () {
        // assert.expect(1);
        var collection = new timeforce.Collection([{ id: 1 }, { id: 2 }, { id: 3 }]);
        collection.on('update', function () { assert.ok(true); });
        collection.remove([{ id: 1 }, { id: 2 }]);
    });

    it('remove does not trigger `update` when nothing removed', function () {
        // assert.expect(0);
        var collection = new timeforce.Collection([{ id: 1 }, { id: 2 }]);
        collection.on('update', function () { assert.ok(false); });
        collection.remove([{ id: 3 }]);
    });

    it('set triggers `set` event once', function () {
        // assert.expect(1);
        var collection = new timeforce.Collection([{ id: 1 }, { id: 2 }]);
        collection.on('update', function () { assert.ok(true); });
        collection.set([{ id: 1 }, { id: 3 }]);
    });

    it('set does not trigger `update` event when nothing added nor removed', function () {
        var collection = new timeforce.Collection([{ id: 1 }, { id: 2 }]);
        collection.on('update', function (coll, options) {
            assert.equal(options.changes.added.length, 0);
            assert.equal(options.changes.removed.length, 0);
            assert.equal(options.changes.merged.length, 2);
        });
        collection.set([{ id: 1 }, { id: 2 }]);
    });

    it('#3610 - invoke collects arguments', function () {
        // assert.expect(3);
        var Model = timeforce.Model.extend({
            method: function (x, y, z) {
                assert.equal(x, 1);
                assert.equal(y, 2);
                assert.equal(z, 3);
            }
        });
        var Collection = timeforce.Collection.extend({
            model: Model
        });
        var collection = new Collection([{ id: 1 }]);
        collection.invoke('method', 1, 2, 3);
    });

    it('#3662 - triggering change without model will not error', function () {
        // assert.expect(1);
        var collection = new timeforce.Collection([{ id: 1 }]);
        var model = collection.first();
        collection.on('change', function (m) {
            assert.equal(m, undefined);
        });
        model.trigger('change');
    });

    it('#3871 - falsy parse result creates empty collection', function () {
        var collection = new (timeforce.Collection.extend({
            parse: function (data, options) { }
        }));
        collection.set('', { parse: true });
        assert.equal(collection.length, 0);
    });

    it("#3711 - remove's `update` event returns one removed model", function () {
        var model = new timeforce.Model({ id: 1, title: 'First Post' });
        var collection = new timeforce.Collection([model]);
        collection.on('update', function (context, options) {
            var changed = options.changes;
            assert.deepEqual(changed.added, []);
            assert.deepEqual(changed.merged, []);
            assert.strictEqual(changed.removed[0], model);
        });
        collection.remove(model);
    });

    it("#3711 - remove's `update` event returns multiple removed models", function () {
        var model = new timeforce.Model({ id: 1, title: 'First Post' });
        var model2 = new timeforce.Model({ id: 2, title: 'Second Post' });
        var collection = new timeforce.Collection([model, model2]);
        collection.on('update', function (context, options) {
            var changed = options.changes;
            assert.deepEqual(changed.added, []);
            assert.deepEqual(changed.merged, []);
            assert.ok(changed.removed.length === 2);

            assert.ok(_.indexOf(changed.removed, model) > -1 && _.indexOf(changed.removed, model2) > -1);
        });
        collection.remove([model, model2]);
    });

    it("#3711 - set's `update` event returns one added model", function () {
        var model = new timeforce.Model({ id: 1, title: 'First Post' });
        var collection = new timeforce.Collection();
        collection.on('update', function (context, options) {
            var addedModels = options.changes.added;
            assert.ok(addedModels.length === 1);
            assert.strictEqual(addedModels[0], model);
        });
        collection.set(model);
    });

    it("#3711 - set's `update` event returns multiple added models", function () {
        var model = new timeforce.Model({ id: 1, title: 'First Post' });
        var model2 = new timeforce.Model({ id: 2, title: 'Second Post' });
        var collection = new timeforce.Collection();
        collection.on('update', function (context, options) {
            var addedModels = options.changes.added;
            assert.ok(addedModels.length === 2);
            assert.strictEqual(addedModels[0], model);
            assert.strictEqual(addedModels[1], model2);
        });
        collection.set([model, model2]);
    });

    it("#3711 - set's `update` event returns one removed model", function () {
        var model = new timeforce.Model({ id: 1, title: 'First Post' });
        var model2 = new timeforce.Model({ id: 2, title: 'Second Post' });
        var model3 = new timeforce.Model({ id: 3, title: 'My Last Post' });
        var collection = new timeforce.Collection([model]);
        collection.on('update', function (context, options) {
            var changed = options.changes;
            assert.equal(changed.added.length, 2);
            assert.equal(changed.merged.length, 0);
            assert.ok(changed.removed.length === 1);
            assert.strictEqual(changed.removed[0], model);
        });
        collection.set([model2, model3]);
    });

    it("#3711 - set's `update` event returns multiple removed models", function () {
        var model = new timeforce.Model({ id: 1, title: 'First Post' });
        var model2 = new timeforce.Model({ id: 2, title: 'Second Post' });
        var model3 = new timeforce.Model({ id: 3, title: 'My Last Post' });
        var collection = new timeforce.Collection([model, model2]);
        collection.on('update', function (context, options) {
            var removedModels = options.changes.removed;
            assert.ok(removedModels.length === 2);
            assert.strictEqual(removedModels[0], model);
            assert.strictEqual(removedModels[1], model2);
        });
        collection.set([model3]);
    });

    it("#3711 - set's `update` event returns one merged model", function () {
        var model = new timeforce.Model({ id: 1, title: 'First Post' });
        var model2 = new timeforce.Model({ id: 2, title: 'Second Post' });
        var model2Update = new timeforce.Model({ id: 2, title: 'Second Post V2' });
        var collection = new timeforce.Collection([model, model2]);
        collection.on('update', function (context, options) {
            var mergedModels = options.changes.merged;
            assert.ok(mergedModels.length === 1);
            assert.strictEqual(mergedModels[0].get('title'), model2Update.get('title'));
        });
        collection.set([model2Update]);
    });

    it("#3711 - set's `update` event returns multiple merged models", function () {
        var model = new timeforce.Model({ id: 1, title: 'First Post' });
        var modelUpdate = new timeforce.Model({ id: 1, title: 'First Post V2' });
        var model2 = new timeforce.Model({ id: 2, title: 'Second Post' });
        var model2Update = new timeforce.Model({ id: 2, title: 'Second Post V2' });
        var collection = new timeforce.Collection([model, model2]);
        collection.on('update', function (context, options) {
            var mergedModels = options.changes.merged;
            assert.ok(mergedModels.length === 2);
            assert.strictEqual(mergedModels[0].get('title'), model2Update.get('title'));
            assert.strictEqual(mergedModels[1].get('title'), modelUpdate.get('title'));
        });
        collection.set([model2Update, modelUpdate]);
    });

    it("#3711 - set's `update` event should not be triggered adding a model which already exists exactly alike", function () {
        var fired = false;
        var model = new timeforce.Model({ id: 1, title: 'First Post' });
        var collection = new timeforce.Collection([model]);
        collection.on('update', function (context, options) {
            fired = true;
        });
        collection.set([model]);
        assert.equal(fired, false);
    });

    it('get models with `attributes` key', function () {
        var model = { id: 1, attributes: {} };
        var collection = new timeforce.Collection([model]);
        assert.ok(collection.get(model));
    });

    it('#4233 - can instantiate new model in ES class Collection', function () {
        class MyModel extends timeforce.Model { }

        class MyCollection extends timeforce.Collection {
            modelId(attr) {
                return attr.x;
            }

            model(attributes, options) {
                return new MyModel(attributes, options);
            }
        }

        var inst, model;
        try {
            inst = new MyCollection([{ a: 2 }]);
            model = inst.model();
        } catch (ex) { }

        assert.ok(inst instanceof timeforce.Collection && model instanceof timeforce.Model, 'Should instantiate collection with model');
    });

    it('plugin methods', function () {
        // assert.expect(3);
        var Collection = timeforce.Collection.extend({
            preinitializePluginMethods: ['counter1'],
            initializePluginMethods: ['counter3', 'counter4'],
            counter1() { this.counter = 1; },
            counter2() { this.counter += 2; assert.equal(this.counter, 3); },
            counter3() { this.counter += 3; assert.equal(this.counter, 6); },
            counter4() { this.counter += 4; assert.equal(this.counter, 10); },
            initialize: function () {
                this.counter += 5;
            }
        });
        Collection.prototype.preinitializePluginMethods.push('counter2');

        var collection = new Collection();
        assert.equal(collection.counter, 15);
    });

    it('setting an alternative cid prefix', function () {
        // assert.expect(4);
        var Collection = timeforce.Collection.extend({
            cidPrefix: 'a'
        });
        var collection = new Collection();

        assert.equal(collection.cid.charAt(0), 'a');

        collection = new timeforce.Collection();
        assert.equal(collection.cid.charAt(0), 'c');
    });

    it('set form attributes into collection', function () {
        var data1 = { value: 'somevalue' },
            data2 = { othervalue: 'value' };
        col.setForm(data1);
        col.setForm('othervalue', data2.othervalue);
        assert.ok(col.form.isModel());
        assert.deepEqual(_.extend(data1, data2), col.form.attributes);
    });

    it('isModel or isCollection', function () {
        assert.equal(col.isModel(), false);
        assert.equal(col.isCollection(), true);
    });

    it('collection get (filters, pagination and more)', function () {
        var form = new timeforce.Model({ filters: { name: 'bruno' }, pagination: { page: 1, limit: 10 } });
        var collection = new timeforce.Collection();
        collection.form = form;
        collection.url = '/test';
        collection.fetch();

        assert.equal(env.syncArgs.method, 'read');
        assert.equal(env.syncArgs.model, collection);

        assert.deepEqual(env.syncArgs.options.querystring, jsonToQueryString(form.toJSON()));
    });

    it('collection post (filters, pagination and more)', function () {
        var form = new timeforce.Model({ filters: { name: 'bruno' }, pagination: { page: 1, limit: 10 } });
        var collection = new timeforce.Collection();
        collection.form = form;
        collection.url = '/test';
        collection.sendFormAsPost = true;
        collection.fetch();

        assert.equal(env.syncArgs.method, 'create');
        assert.equal(env.syncArgs.model, collection);
        assert.deepEqual(env.syncArgs.options.data, form.toJSON());
    });

    it('fnfy', function () {
        var fn;
        fn = col.fnfy('cid');
        assert.ok(_.isFunction(fn));
        assert.equal(fn(), col.cid);

        fn = col.fnfy('anything');
        assert.ok(typeof fn() === 'undefined');

        col.anything = (value) => { return { value }; };
        fn = col.fnfy('anything');
        assert.deepEqual(fn('somevalue'), { value: 'somevalue' });

        col.anything = (value) => value;
        fn = col.fnfy('anything');
        assert.equal(fn('somevalue'), 'somevalue');
    });

    it('mock GET', function (done) {
        var collection = otherCol;
        collection.url = () => '/';
        collection.mock = true;
        collection.mocks = {
            'GET': [{ id: 1 }, { id: 10 }]
        };
        collection.on('fetch', function () {
            assert.deepEqual(collection.toJSON(), collection.mocks['GET']);
            done();
        });

        collection.fetch();
    });

    it('global mock GET', function (done) {
        var collection = otherCol;
        collection.name = 'test';
        collection.url = () => '/';
        timeforce.mock = true;
        timeforce.mocks = {
            collection: {
                test: {
                    'GET': [{ id: 1 }, { id: 10 }]
                }
            }
        };
        collection.on('fetch', function () {
            assert.deepEqual(collection.toJSON(), timeforce.mocks.collection.test['GET']);
            timeforce.mock = false;
            done();
        });

        collection.fetch();
    });

});


// describe('Collection ES6', function () {

//     it('Combining methods to prototype', function () {
//         var methodsList = {
//             getMyCid() { return this.cid; },
//             method1() { return '1'; },
//             method2() { return this.method1() + '2'; },
//         };

//         class ProtoMethods extends timeforce.Collection {
//             mixMethods() {
//                 return {
//                     ...methodsList,
//                     method3() { return this.method2() + '3'; },
//                     method4() { return this.method3() + '4'; },
//                     showMethods() { return this.method4(); }
//                 };
//             }
//         }

//         var obj = new ProtoMethods;
//         assert.notEqual(obj.getMyCid(), undefined);
//         assert.equal(obj.showMethods(), '1234');

//     });
// });