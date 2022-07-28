import fs from 'fs';
import glob from 'glob';
import filesize from 'filesize';
import * as Terser from 'terser';

const getSize = (file) => {
    const { size } = fs.statSync(file)
    return filesize(size)
}

glob("./src/*.js", {}, function (er, files) {
    var dir = './dist';

    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }

        files.map(file => {
            console.log(`Minifying ${file} (${getSize(file)})`);
            const fileTo = file.replace('./src', dir).replace('.js', '.min.js');
            Terser.minify(fs.readFileSync(file, 'utf8'), {}).then((terserResult) => {
                // replace on imports
                var code = terserResult.code.replace(/\.js/g, '.min.js');
                fs.writeFileSync(fileTo, code, 'utf8');
                console.log(`Minifying ${fileTo} (${getSize(file)}) success.`);
            }).catch((e) => {
                console.log(`Minifying ${file} error.`, e);
            });
        });
    } catch (e) {
        console.log('Create dir failed ' + dir);
    }
});