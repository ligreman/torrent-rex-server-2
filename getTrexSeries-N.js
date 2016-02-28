'use strict';

var DEBUG = false,
    $OPENSHIFT_REPO_DIR = '/var/lib/openshift/54c7ea625973caf628000150/app-root/runtime/repo/';

var request = require('request'),
    cheerio = require('cheerio'),
    async = require('async'),
    mongoose = require('mongoose'),
    modelos = require('./models/trex-models.js'),
    md5 = require('md5'),
    events = require('events'),
    fs = require('fs');

var urls = {
        txibitsoft: 'http://www.txibitsoft.com/categorias.php',
        newpctPagSD: 'http://www.newpct1.com/index.php?page=categorias&url=series/&letter=&pg=',
        newpctPagHD: 'http://www.newpct1.com/index.php?page=categorias&url=series-hd/&letter=&pg=',
        newpctPagVO: 'http://www.newpct1.com/index.php?page=categorias&url=series-vo/&letter=&pg=',
        newpctTorrentsSD: 'series/',
        newpctTorrentsHD: 'series-hd/',
        newpctTorrentsVO: 'series-vo/'
    },
    series_newpct_short = {sd: [], hd: [], vo: []},
    series_newpct = {sd: [], hd: [], vo: []};

//Gestor de eventos
var eventEmitter = new events.EventEmitter();

mongoose.set('debug', true);

//Inicio conexión de mongo
var dbTrex = mongoose.createConnection(process.env.OPENSHIFT_MONGODB_DB_URL + process.env.OPENSHIFT_APP_NAME || 'mongodb://localhost/trex', {
    db: {safe: true}
});

//Modo debug
dbTrex.on('error', console.error.bind(console, 'Error conectando a MongoDB:'));
dbTrex.on("connected", console.log.bind(console, 'Conectado a MongoDB: Trex'));

//Modelos
var Serie = dbTrex.model('Serie', modelos.serieDetailSchema),
    SerieExtract = dbTrex.model('SerieExtract', modelos.serieExtractSchema),
    SeriesT = dbTrex.model('SeriesT', modelos.seriesTSchema),
    SeriesN = dbTrex.model('SeriesN', modelos.seriesNSchema);

console.log('Comienzo proceso');

/*************** LISTENER DE EVENTOS ********************/

//Extraigo las series de newpct
eventEmitter.on('getSeriesNewpct', function ($type) {
    console.log('Extraigo series ' + $type + ' de newpct.');
    console.log('    Primero saco las páginas que hay.');
    var $url;
    switch ($type) {
        case 'sd':
            $url = urls.newpctPagSD;
            break;
        case 'hd':
            $url = urls.newpctPagHD;
            break;
        case 'vo':
            $url = urls.newpctPagVO;
            break;
    }

    request($url + '1', function (err, resp, body) {
        if (err) {
            throw err;
        }

        var $ = cheerio.load(body);

        //Cojo la paginación
        var paginas = $('ul.pagination li').length;
        var enlaces = [];

        //Miro si hay más páginas o no
        if (paginas == 0) {
            //No hay más
            enlaces.push({url: $url + '1', type: $type});
        } else {
            //Hay más
            paginas = paginas - 2; //elimino los enlaces Next y Last

            //Construyo los enlaces
            for (var i = 1; i <= paginas; i++) {
                enlaces.push({url: $url + i, type: $type});
            }
        }

        console.log('    Ahora saco las series');
        //Cojo la información de las páginas
        async.map(enlaces, extractNewcptSeries, function (err, results) {
            if (err) {
                console.log('Error al obtener las series de newpct ' + $type + ': ' + err);
            }

            eventEmitter.emit('nextActionNewpct', $type);
        });
    });
});

//Decide qué hay que hacer a continuación en NewPCT
eventEmitter.on('nextActionNewpct', function (type) {
    switch (type) {
        case 'sd':
            console.log('    Encontradas ' + series_newpct.sd.length + ' series');
            //Ya he obtenido las SD así que voy a HD
            eventEmitter.emit('getSeriesNewpct', 'hd');
            break;
        case 'hd':
            console.log('    Encontradas ' + series_newpct.hd.length + ' series');
            //Ya he obtenido las HD así que voy a VO
            eventEmitter.emit('getSeriesNewpct', 'vo');
            break;
        case 'vo':
            console.log('    Encontradas ' + series_newpct.vo.length + ' series');
            //Ya he obtenido las VO así que finalizo
            //eventEmitter.emit('saveJSONSeries', series_newpct, series_newpct_short);
            eventEmitter.emit('saveMongoSeries', series_newpct, series_newpct_short);
            break;
    }
});

//Guardo un fichero de series
eventEmitter.on('saveJSONSeries', function (data, data_short) {
    var baseUrl = '';

    if (!DEBUG) {
        baseUrl = $OPENSHIFT_REPO_DIR;
    }

    console.log('Guardo fichero json de newpct');
    fs.writeFileSync(baseUrl + 'jsons/series-n.json', JSON.stringify(data_short), 'utf8');
    //fs.writeFileSync('jsons/nData.json', JSON.stringify(data), 'utf8');
    //console.log(data);
    //console.log(data_short);
    //Guardo ficheros por cada serie si no existen ya
    data['sd'].forEach(function (element) {
        //console.log("Guardo sd: " + element.id);
        if (fs.existsSync(baseUrl + 'jsons/series/' + element.id + '.json') === false) {
            //console.log("    SI");
            fs.writeFileSync(baseUrl + 'jsons/series/' + element.id + '.json', JSON.stringify(element), 'utf8');
        }
    });
    data['hd'].forEach(function (element) {
        //console.log("Guardo hd: " + element.id);
        if (fs.existsSync(baseUrl + 'jsons/series/' + element.id + '.json') === false) {
            //console.log("    SI");
            fs.writeFileSync(baseUrl + 'jsons/series/' + element.id + '.json', JSON.stringify(element), 'utf8');
        }
    });
    data['vo'].forEach(function (element) {
        //console.log("Guardo vo: " + element.id);
        if (fs.existsSync(baseUrl + 'jsons/series/' + element.id + '.json') === false) {
            //console.log("    SI");
            fs.writeFileSync(baseUrl + 'jsons/series/' + element.id + '.json', JSON.stringify(element), 'utf8');
        }
    });
});


eventEmitter.on('saveMongoSeries', function (data, data_short) {
    var cuantos = data['sd'].length, cuenta = 0;

    SeriesN.update({"_id": "1234"}, data_short, {upsert: true}, function (err) {
        if (err) {
            console.error(err);
        }

        console.log('    Mongo - He guardado la parte corta de las series N');
        console.log('Guardo Mongo de N-1');

        data['sd'].forEach(function (element) {
            Serie.update({"_id": element._id}, element, {upsert: true}, function (err) {
                if (err) {
                    console.error(err);
                }

                cuenta++;
                console.log("metido: " + element._id);

                if (cuenta >= cuantos) {
                    eventEmitter.emit('saveMongoSeries2', data);
                }
            });
        });
    });
});

eventEmitter.on('saveMongoSeries2', function (data) {
    console.log('Guardo Mongo de N-2');

    var cuantos = data['hd'].length, cuenta = 0;

    data['hd'].forEach(function (element2) {
        Serie.update({"_id": element2._id}, element2, {upsert: true}, function (err) {
            if (err) {
                console.error(err);
            }
            cuenta++;
            console.log("metido: " + element2._id);

            if (cuenta >= cuantos) {
                eventEmitter.emit('saveMongoSeries3', data);
            }
        });
    });
});

eventEmitter.on('saveMongoSeries3', function (data) {
    console.log('Guardo Mongo de N-3');
    var cuantos = data['vo'].length, cuenta = 0;

    data['vo'].forEach(function (element3) {
        Serie.update({"_id": element3._id}, element3, {upsert: true}, function (err) {
            if (err) {
                console.error(err);
            }
            cuenta++;
            console.log("metido: " + element3._id);

            if (cuenta >= cuantos) {
                eventEmitter.emit('finalize', data);
            }
        });
    });
});

//Listener del evento de terminar
eventEmitter.on('finalize', function () {
    mongoose.disconnect();
    console.log('Finalizado');

    //Finalizo
    process.exit();
});


/*************** MAIN ******************/

//Obtengo las series de Txbit y luego las de newpct
eventEmitter.emit('getSeriesNewpct', 'sd');


/**************** FUNCIONES *****************/
function extractNewcptSeries(enlace, callback) {
    //innerElements.push({name: $(this).text(), url: urlEncoded});

    request(enlace.url, function (err, resp, body) {
        if (err) {
            callback(err);
        }

        var $ = cheerio.load(body);

        //Cojo la lista de series
        $('ul.pelilist li').each(function () {
            var a = $(this).find('a'), $id;
            var href = a.attr('href');
            var title = a.attr('title');
            var urlEncoded;

            //console.log(title);

            switch (enlace.type) {
                case 'sd':
                    //escapo la URL
                    urlEncoded = encodeURI(urls.newpctTorrentsSD + extractNewpctHref(href, enlace.type) + '/');
                    //urlEncoded = new Buffer(urlEncoded).toString('base64');

                    $id = md5('N' + enlace.type + urlEncoded);

                    series_newpct.sd.push({
                        //_id: $id,
                        id: $id,
                        name: extractNewpctTitle(title),
                        url: urlEncoded,
                        source: 'N'
                    });
                    series_newpct_short.sd.push({
                        id: $id,
                        name: extractNewpctTitle(title)
                    });
                    break;
                case 'hd':
                    //escapo la URL
                    urlEncoded = encodeURI(urls.newpctTorrentsHD + extractNewpctHref(href, enlace.type) + '/');
                    //urlEncoded = new Buffer(urlEncoded).toString('base64');

                    $id = md5('N' + enlace.type + urlEncoded);

                    series_newpct.hd.push({
                        //_id: $id,
                        id: $id,
                        name: extractNewpctTitle(title),
                        url: urlEncoded,
                        source: 'N'
                    });
                    series_newpct_short.hd.push({
                        id: $id,
                        name: extractNewpctTitle(title)
                    });
                    break;
                case 'vo':
                    //escapo la URL
                    urlEncoded = encodeURI(urls.newpctTorrentsVO + extractNewpctHref(href, enlace.type) + '/');
                    //urlEncoded = new Buffer(urlEncoded).toString('base64');

                    $id = md5('N' + enlace.type + urlEncoded);

                    series_newpct.vo.push({
                        //_id: $id,
                        id: $id,
                        name: extractNewpctTitle(title),
                        url: urlEncoded,
                        source: 'N'
                    });
                    series_newpct_short.vo.push({
                        id: $id,
                        name: extractNewpctTitle(title)
                    });
                    break;
            }

        });

        //Termino
        callback(null, true);
    });
}


function extractNewpctTitle(title) {
    var patt = /(Ver online |Descarga Serie HD |Ver en linea )(.*)(-.*)/;

    var res = patt.exec(title);

    if (res !== null) {
        return res[2].trim();
    } else {
        patt = /(Ver online |Descarga Serie HD |Ver en linea )(.*)/;
        res = patt.exec(title);

        if (res !== null) {
            return res[2].trim();
        } else {
            return null;
        }
    }
}

function extractNewpctHref(href, type) {
    var patt;

    switch (type) {
        case 'sd':
            patt = /(.*\/series\/)(.*)(\/.*)/;
            break;
        case 'hd':
            patt = /(.*\/series-hd\/)(.*)(\/.*)/;
            break;
        case 'vo':
            patt = /(.*\/series-vo\/)(.*)(\/.*)/;
            break;
    }

    var res = patt.exec(href);

    if (res !== null) {
        return res[2].trim();
    } else {
        return null;
    }
}