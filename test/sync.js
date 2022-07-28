import assert from 'assert';
import _ from 'lodash';
import { env, timeforce } from './setup.js';


describe('Sync', function () {

    var Library = timeforce.Collection.extend({
        url: function () { return '/library'; }
    });
    var Book = timeforce.Model.extend({
        url: function () { return '/book'; }
    });
    var library, book;

    var attrs = {
        title: 'The Tempest',
        author: 'Bill Shakespeare',
        length: 123
    };

    beforeEach(async (done) => {
        library = new Library();
        book = new Book();
        // library.create(attrs, { wait: false });
        done();
    });


    it('read', function () {
        library.fetch();
        assert.equal(env.persistSettings.url, '/library?');
        assert.equal(env.persistSettings.type, 'GET');
        assert.equal(env.persistSettings.responseType, 'json');
        assert.ok(_.isEmpty(env.persistSettings.data));
    });

    it('passing data', function () {
        book.fetch({ data: { a: 'a', one: 1 } });

        assert.equal(env.persistSettings.url, '/book');
        assert.equal(env.persistSettings.data.a, 'a');
        assert.equal(env.persistSettings.data.one, 1);
    });

    it('create', function () {
        library.create(attrs, { wait: false });
        assert.equal(env.persistSettings.url, '/library');
        assert.equal(env.persistSettings.type, 'POST');
        assert.equal(env.persistSettings.responseType, 'json');
        var data = (env.persistSettings.data);
        assert.equal(data.title, 'The Tempest');
        assert.equal(data.author, 'Bill Shakespeare');
        assert.equal(data.length, 123);
    });

    it('update', function () {
        library.create(attrs, { wait: false });
        library.first().save({ id: '1-the-tempest', author: 'William Shakespeare' });
        assert.equal(env.persistSettings.url, '/library/1-the-tempest');
        assert.equal(env.persistSettings.type, 'PUT');
        assert.equal(env.persistSettings.responseType, 'json');
        var data = (env.persistSettings.data);
        assert.equal(data.id, '1-the-tempest');
        assert.equal(data.title, 'The Tempest');
        assert.equal(data.author, 'William Shakespeare');
        assert.equal(data.length, 123);
    });

    it('update with emulateJSON', function () {
        library.create(attrs, { wait: false });
        library.first().save({ id: '2-the-tempest', author: 'Tim Shakespeare' }, {
            emulateJSON: true
        });
        assert.equal(env.persistSettings.url, '/library/2-the-tempest');
        assert.equal(env.persistSettings.type, 'PUT');
        assert.equal(env.persistSettings.contentType, 'application/x-www-form-urlencoded');
        var data = JSON.parse(env.persistSettings.data.model);
        assert.equal(data.id, '2-the-tempest');
        assert.equal(data.author, 'Tim Shakespeare');
        assert.equal(data.length, 123);
    });

    it('read model', function () {
        library.create(attrs, { wait: false });
        library.first().save({ id: '2-the-tempest', author: 'Tim Shakespeare' });
        library.first().fetch();
        assert.equal(env.persistSettings.url, '/library/2-the-tempest');
        assert.equal(env.persistSettings.type, 'GET');
        assert.ok(_.isEmpty(env.persistSettings.data));
    });

    it('destroy', function () {
        library.create(attrs, { wait: false });
        library.first().save({ id: '2-the-tempest', author: 'Tim Shakespeare' });
        library.first().destroy({ wait: true });
        assert.equal(env.persistSettings.url, '/library/2-the-tempest');
        assert.equal(env.persistSettings.type, 'DELETE');
        assert.equal(env.persistSettings.data, null);
    });

    it('urlError', function () {
        var model = new timeforce.Model();
        assert.throws(function () {
            model.fetch();
        });
        model.fetch({ url: '/one/two' });
        assert.equal(env.persistSettings.url, '/one/two');
    });

    it('#1052 - `options` is optional.', function () {
        var model = new timeforce.Model();
        model.url = '/test';
        timeforce.sync('create', model);
    });

    it('timeforce.persist', function () {
        var persist = timeforce.persist;
        timeforce.persist = function (settings) {
            assert.strictEqual(settings.url, '/test');
        };
        var model = new timeforce.Model();
        model.url = '/test';
        timeforce.sync('create', model);

        timeforce.persist = persist;
    });

    it('Call provided error callback on error.', function (done) {
        var model = new timeforce.Model();
        model.url = '/test';
        timeforce.sync('read', model, {
            error: function () {
                assert.ok(true); done();
            }
        });

        env.persistSettings.error();
    });

    it('Use timeforce.emulateJSON as default.', function () {
        var model = new timeforce.Model;
        model.url = '/test';

        timeforce.emulateJSON = true;
        model.sync('create', model);
        assert.strictEqual(env.persistSettings.emulateJSON, true);

        timeforce.emulateJSON = false;
        model.sync('create', model);
        assert.strictEqual(env.persistSettings.emulateJSON, false);
    });

    it('#1756 - Call user provided beforeSend function.', function () {
        timeforce.emulateHTTP = true;
        var model = new timeforce.Model;
        model.url = '/test';
        var xhr = {
            setRequestHeader: function (header, value) {
                assert.strictEqual(header, 'X-HTTP-Method-Override');
                assert.strictEqual(value, 'DELETE');
            }
        };
        model.sync('delete', model, {
            beforeSend: function (_xhr) {
                assert.ok(_xhr === xhr);
                return false;
            }
        });
        assert.strictEqual(env.persistSettings.beforeSend(xhr), false);
    });

    it('#2928 - Pass along `textStatus` and `errorThrown`.', function () {
        var model = new timeforce.Model;
        model.url = '/test';
        model.on('error', function (m, xhr, options) {
            assert.strictEqual(options.textStatus, 'textStatus');
            assert.strictEqual(options.errorThrown, 'errorThrown');
        });
        model.fetch();
        env.persistSettings.error({}, 'textStatus', 'errorThrown');
    });

    it('fetch:error event', function (done) {
        var model = new timeforce.Model;
        model.url = '/test';
        model.on('fetch:error', function (m, xhr, options) {
            assert.strictEqual(options.textStatus, 'textStatus');
            assert.strictEqual(options.errorThrown, 'errorThrown');
            done();
        });
        model.fetch();
        env.persistSettings.error({}, 'textStatus', 'errorThrown');
    });

    it('save:error event', function (done) {
        var model = new timeforce.Model({ some: 'data' });
        model.url = '/test';
        model.on('save:error', function (m, xhr, options) {
            assert.strictEqual(options.textStatus, 'textStatus');
            assert.strictEqual(options.errorThrown, 'errorThrown');
            done();
        });
        model.save();
        env.persistSettings.error({}, 'textStatus', 'errorThrown');
    });

});
