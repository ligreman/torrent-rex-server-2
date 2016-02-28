'use strict';

var DEBUG = false;

var fs           = require('fs'),
    parseTorrent = require('parse-torrent'),
    exec         = require('child_process').exec,
    sys          = require('sys'),
    shell        = require('./utils/execMultiple'),
    async        = require('async');

var pathTorrents     = 'D:\\Descargas\\Torrents\\',
    pathVideos       = 'D:\\Videos\\Series\\',
    extensionesVideo = ['.avi', '.mkv', '.mp4', '.mpg', '.mpeg'];

//Leo la ruta de los torrents y recojo los .torrent de allí
var dirFiles       = fs.readdirSync(pathTorrents),
    filebotFolders = [];

//fs.renameSync('D:\\Descargas\\Torrents\\Legends - Temporada 1 [HDTV 720p][Cap.107][AC3 5.1 Español Castellano]\\Leg107 [www.newpct1.com].avi', 'D:\\Videos\\Series\\Leg107 [www.newpct1.com].avi');

//process.exit();
//Por cada torrent...
dirFiles.forEach(function (file) {
    //Miro a ver si es un .torrent
    if (file.endsWith('.torrent')) {
        logger(file);

        //Decodifico el torrent
        var data = processTorrent(file, pathTorrents);

        //A ver si ha ido bien
        if (data === null) {
            //Vaya, no pude procesar el torrent, lo borro

            fs.unlinkSync(pathTorrents + file);
            logger("BORRO torrent, que data es null");
        } else {
            logger('Procesados');
            logger(data);

            //Cojo los ficheros uno a uno y los muevo
            data.forEach(function (video) {
                //Si la carpeta y fichero origen existen
                logger("Miro: " + pathTorrents + video.folder + video.file);

                var existe = true;
                try {
                    fs.accessSync(pathTorrents + video.folder + video.file);
                } catch (e) {
                    logger("Error al existir: " + e);
                    existe = false;
                }

                logger("Existe: " + existe);

                if (existe) {
                    //Lo muevo a la carpeta/temporada/ correspondiente en D:/Videos/Series/
                    var oldPath    = pathTorrents + video.folder + video.file,
                        newDir     = pathVideos + video.name,
                        newDirTemp = pathVideos + video.name + '\\Temporada ' + video.season,
                        newPath    = pathVideos + video.name + '\\Temporada ' + video.season + '\\';// + video.file;

                    //Si tengo el capítulo cambio el nombre del fichero final
                    if (video.chapter && !isNaN(video.chapter)) {
                        //Saco la extensión
                        var ext = video.file.split('.');
                        ext = ext[ext.length - 1];

                        newPath += video.name + ' ' + video.season + 'x' + video.chapter + '.' + ext;
                    } else {
                        //Dejo el que venía por defecto
                        newPath += video.file;
                    }

                    var moved = true;
                    try {
                        //Si no existe el nuevo directorio de Serie
                        try {
                            fs.accessSync(newDir);
                        } catch (e) {
                            logger("No existe el directorio de la serie, lo creo");
                            fs.mkdirSync(newDir);
                        }

                        //Si no existe el nuevo directorio de Temporada
                        try {
                            fs.accessSync(newDirTemp);
                        } catch (e) {
                            logger("No existe el directorio de temporada, lo creo");
                            fs.mkdirSync(newDirTemp);
                        }

                        fs.renameSync(oldPath, newPath);
                    } catch (e2) {
                        logger("Error al mover: " + e2);
                        moved = false;
                    }

                    //Si todo ha ido bien borro el .torrent y la carpeta origen
                    if (moved) {
                        logger("BORRO torrent, que todo ok");
                        try {
                            fs.unlinkSync(pathTorrents + file);
                            //fs.unlinkSync(pathTorrents + video.folder);
                            deleteFolderRecursive(pathTorrents + video.folder);

                            //Añado la carpeta al filebot
                            //filebotFolders.push(newDirTemp);
                        } catch (e3) {
                            logger("Error al borrar: " + e3);
                        }
                    }
                }
            });
        }
    }
});

//Una vez movido todo, paso el FileBot a cada carpeta
/*var yaProcesado = [], comandos = [];

 filebotFolders.forEach(function (folder) {
 //Solo sigo si no he procesado ya esa carpeta
 if (yaProcesado.indexOf(folder) === -1) {
 comandos.push('filebot -rename "' + folder + '" -r -non-strict --lang es --db TheTVDB --conflict skip');
 }
 });

 //Lanzo los comandos a la guerra
 shell.series(comandos, function (err) {
 if (err) {
 console.log('FileBot error: ' + err);
 } else {
 console.log('FileBot OK');
 }
 });*/

/******************************************************/
function processTorrent(torrent, ruta) {
    var name, temp, capi, result = [], aux;
    var patt = /(.*) - (Temp\.|Temporada )([0-9]+) \[([a-zA-Z 0-9]+)\]\[([a-zA-Z\.0-9]+)\]\[(.+)\]/;

    //Lo parseo
    var infoTorrent = parseTorrent(fs.readFileSync(ruta + torrent));

    logger("Torrent info");
    logger(infoTorrent.name);
    logger(infoTorrent.files);

    //Busco patrones
    var patrones = patt.exec(infoTorrent.name);
    if (patrones) {
        name = patrones[1];
        temp = patrones[3];
        capi = patrones[5].substr(-2);
    }

    //Si name o temp son undefined aquí, intento el segundo algoritmo
    if (!name || !temp) {
        var patt2 = /(.+) ([0-9]{2}x[0-9]{1,2})/;

        patrones = patt2.exec(infoTorrent.name);

        if (patrones) {
            name = patrones[1].replace('.', ' ').trim();
            aux = patrones[2].split('x');
            temp = aux[0];
            capi = aux[1];
        }
    }

    //Otro intento
    if (!name || !temp) {
        var patt3 = /(.+) ([0-9]{1}x[0-9]{1,2})/;

        patrones = patt3.exec(infoTorrent.name);

        if (patrones) {
            name = patrones[1].replace('.', ' ').trim();
            aux = patrones[2].split('x');
            temp = aux[0];
            capi = aux[1];
        }
    }

    //Si he obtenido name y temp sigo
    if (name && temp) {
        //Localizo el file que es el video
        var path;
        infoTorrent.files.forEach(function (file) {
            path = file.path.split('\\');

            //Último elemento
            var last    = path[path.length - 1],
                esVideo = false;

            logger('  * Miro a ver si ' + last + ' es video');
            //Miro a ver si es un vídeo, por su extensión final
            extensionesVideo.forEach(function (ext) {
                if (last.endsWith(ext)) {
                    esVideo = true;
                    logger('    --> Es un video ' + ext);
                }
            });

            //Si lo es, lo guardo en la lista de videos a devolver
            if (esVideo) {

                result.push({
                    name: name,
                    season: temp,
                    chapter: capi,
                    folder: file.path.replace(last, ''),
                    file: last
                });
            }
        });

        return result;
    } else {
        return null;
    }
}


//Añado al prototipo de String la función endsWith
if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function (suffix) {
        return this.indexOf(suffix, this.length - suffix.length) !== -1;
    };
}

function logger(msg) {
    if (DEBUG) {
        console.log(msg);
    }
}

/*
 fs.rename(oldPath, newPath, function (err) {
 if (err) {
 if (err.code === 'EXDEV') {
 copy();
 } else {
 callback(err);
 }
 return;
 }
 callback();
 });

 function copy () {
 var readStream = fs.createReadStream(oldPath);
 var writeStream = fs.createWriteStream(newPath);

 readStream.on('error', callback);
 writeStream.on('error', callback);
 readStream.on('close', function () {

 fs.unlink(oldPath, callback);
 });

 readStream.pipe(writeStream);

 }
 */

function deleteFolderRecursive(path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file, index) {
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}

/*
 filebot -rename "carpeta" -r -non-strict --lang es --db TheTVDB --conflict skip
 */