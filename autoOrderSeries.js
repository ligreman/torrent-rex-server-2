// Instalar previamente npm install -g 7zip

'use strict';

var DEBUG = false;

var fs = require('fs'),
    parseTorrent = require('parse-torrent'),
    exec = require('child_process').exec,
    //    sys          = require('sys'),
    request = require('request'),
    cheerio = require('cheerio'),
    // shell = require('./utils/execMultiple'),
    events = require('events'),
    Q = require('q');

var eventEmitter = new events.EventEmitter();
var pathTorrents = 'D:\\Descargas\\Torrents\\',
    pathVideos = 'D:\\Videos\\Series\\',
    extensionesVideo = ['.avi', '.mkv', '.mp4', '.mpg', '.mpeg'],
    extensionesZip = ['.rar'];

//Leo la ruta de los torrents y recojo los .torrent de allí
var dirFiles = fs.readdirSync(pathTorrents),
    filebotFolders = [];

//fs.renameSync('D:\\Descargas\\Torrents\\Legends - Temporada 1 [HDTV 720p][Cap.107][AC3 5.1 Español Castellano]\\Leg107 [www.newpct1.com].avi', 'D:\\Videos\\Series\\Leg107 [www.newpct1.com].avi');

//process.exit();
//Por cada torrent...
dirFiles.forEach(function (torrentFile) {
    //Miro a ver si es un .torrent
    if (!torrentFile.endsWith('.torrent')) {
        return;
    }

    // Lo es
    logger("++++++++++++++++++++++++++++++++++++");
    logger("   > Torrent file: " + torrentFile);

    //Decodifico el torrent
    var torrentData = decodeTorrent(torrentFile, pathTorrents);

    //Si ha ido mal, borro el torrent y sigo con el siguiente
    if (torrentData === null || (torrentData.zip.length === 0 && torrentData.videos.length === 0)) {
        fs.unlinkSync(pathTorrents + torrentFile);
        logger("BORRO torrent, que data es null");
        return;
    }

    // Saco los datos
    logger("   > Ficheros contenidos en el torrent:");
    logger(torrentData);

    var promises = [], dataRecover = '';

    // Llamo al descompresor si hay zips
    if (torrentData.zip.length >= 1) {
		dataRecover = torrentData.zip[0];
        torrentData.zip.forEach(function (comprimido) {
            promises.push(decompressZip(comprimido, torrentFile));
        });
    }

    if (torrentData.videos.length >= 1) {
        promises.push(getVideos(torrentData.videos, torrentFile));
		dataRecover = torrentData.videos[0];
        // eventEmitter.emit('processVideos', {torrentFile: torrentFile, torrentDataVideos: torrentData.videos});
    }

    // Cuando tenga todos los ficheros de video, descomprimidos si lo estaban
    Q.allSettled(promises).then(function (results) {
        logger("  >>> Terminaron todas las tareas asíncronas del torrent: " + torrentFile);

        var videosFinal = [];
        results.forEach(function (result) {
            if (result.state === "fulfilled") {
                // Value es un array de videos
                var value = result.value;
                videosFinal = videosFinal.concat(value.videoFiles);
            } else {
                logger(" # Falló un promise: " + result.reason);
				logger(" Intento recuperar y ver si hay videos");

				// Intento comprobar si en la carpeta hay algún video descomprimido videosFinal[comprimido.file, comprimido.folder]
				var existenVideos = checkIfVideos(dataRecover);
				var hayVideos = [];
				hayVideos.push(existenVideos);
logger(hayVideos);
				if (hayVideos && hayVideos.length > 0) {
					videosFinal = hayVideos;
				} else {
					logger(" # No hay videos");
				}
            }
        });

        // Con los videos finales los copio a la carpeta destino y termino
        moveVideosAndEnd(videosFinal, torrentFile);
    });
});

// Comprueba si hay algún video en la ruta
function checkIfVideos(data) {
	var dirFiles = fs.readdirSync(pathTorrents + data.folder), video = '';
logger("Recorro el directorio");
	//Por cada torrent...
	dirFiles.forEach(function (file) {
		extensionesVideo.forEach(function(ext){
			if (file.endsWith(ext)) {
				video = file;
			}
		});
	});

	if (video === '') {
		return false;
	} else {
		return {
			file: video,
			folder: data.folder,
			name: data.name,
			season: data.season,
			chapter: data.chapter			
		};
	}
}

/**
 * Simplemente devuelve el [] de videos como promise
 */
function getVideos(videos, torrentFile) {
    var def = Q.defer();

    def.resolve({videoFiles: videos, torrentFile: torrentFile});

    return def.promise;
}


/******************************************************/
function decodeTorrent(torrent, ruta) {
    var name, temp, capi, resultVideos = [], resultZip = [], aux;
    var patt = /(.*) - (Temp\.|Temporada )([0-9]+) \[([a-zA-Z 0-9]+)\]\[([a-zA-Z\.0-9]+)\]\[(.+)\]/;

    //Lo parseo
    var infoTorrent = parseTorrent(fs.readFileSync(ruta + torrent));

    logger("-- Torrent info --");
    logger("   > " + infoTorrent.name);
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
            var last = path[path.length - 1],
                esVideo = false, esZip = false;

            logger('  * Miro a ver si ' + last + ' es video o comprimido');
            //Miro a ver si es un vídeo, por su extensión final
            extensionesVideo.forEach(function (ext) {
                if (last.endsWith(ext)) {
                    esVideo = true;
                    logger('    --> Es un video ' + ext);
                }
            });

            // Miro a ver si es Zip
            extensionesZip.forEach(function (ext) {
                if (last.endsWith(ext)) {
                    esZip = true;
                    logger('    --> Es un comprimido ' + ext);
                }
            });

            //Si lo es, lo guardo en la lista de videos a devolver
            if (esVideo) {
                resultVideos.push({
                    name: name,
                    season: temp,
                    chapter: capi,
                    folder: file.path.replace(last, ''),
                    file: last
                });
            }
            // Si es zip
            if (esZip) {
                resultZip.push({
                    name: name,
                    season: temp,
                    chapter: capi,
                    folder: file.path.replace(last, ''),
                    file: last
                });
            }
        });

        return {
            videos: resultVideos,
            zip: resultZip
        };
    } else {
        return null;
    }
}

/**
 * Promise que descomprime el zip y obtiene el fichero de video de dentro
 * Borra el zip si todo ok y devuelve datos
 */
function decompressZip(comprimido, torrentFile) {
    /*
     { name: 'The Walking Dead',
     season: '7',
     chapter: '02',
     folder: 'The Walking Dead - Temporada 7 [HDTV][Cap.702][Español Castellano]\\',
     file: 'The Walking Dead 7x02 [www.newpct1.com].rar' }
     */
    var def = Q.defer();

    var dir = pathTorrents + comprimido.folder;

    logger("   > Descomprimo " + comprimido.file);
	var txtFile = null;

    // Tengo que buscar un fichero txt con el texto contraseña en el nombre
	try	{
		var dirFiles = fs.readdirSync(dir);
		dirFiles.forEach(function (ficheroTXT) {
			//Miro a ver si es un .txt
			if (!ficheroTXT.endsWith('.txt')) {
				return;
			}
			// Es el de la contraseña
			if (ficheroTXT.toLowerCase().includes('contraseña')) {
				txtFile = ficheroTXT;
			}
		});		
	} catch (error) {
		logger("Error: " + error);
	}

    if (!txtFile) {
		// Intento descomprimir sin contraseña a ver
		exec('7z x -y -o"' + dir + '" "' + dir + comprimido.file + '"', function (error, stdout, stderr) {
			if (error) {
				def.reject("No encontré fichero con contraseña y no pude descomprimir sin contraseña");
				logger(error);
			} else {
				logger("   > Descomprimido: " + comprimido.file);

				// Borro el rar
				fs.unlinkSync(dir + comprimido.file);

				// Saco el nombre del fichero de video para poder procesarlo luego
				var videoName;
				extensionesZip.forEach(function (ext) {
					if (comprimido.file.endsWith(ext)) {
						extensionesVideo.forEach(function (ext2) {
							var fileVideoName = comprimido.file.replace(ext, ext2);

							//Compruebo si existe
							if (fs.existsSync(pathTorrents + comprimido.folder + fileVideoName)) {
								videoName = fileVideoName;
							}
						});
					}
				});

				if (videoName) {
					comprimido.file = videoName;
					logger("   > Terminada descompresión: " + comprimido.file);
					def.resolve({videoFiles: [comprimido], torrentFile: torrentFile});
				} else {
					def.reject("No encontré fichero con contraseña y no pude descomprimir sin contraseña 2");
				}

				// Llamo a continuar el proceso
				// eventEmitter.emit('unzipFinished', {comprimido: comprimido, file: torrentFile});

			}
		});
    } else {
        // Leo el fichero
        var readed = fs.readFileSync(dir + txtFile, 'utf8');
        // logger(readed);

        // Busco una línea que empieza por http
        var patt = /(http(.*))/;
        var patrones = patt.exec(readed);
        if (!patrones || !patrones[1]) {
            return;
        }

        logger("   > Busco la contraseña de " + comprimido.file);

        // Voy a la url para sacar la contraseña
        request(patrones[1], function (err, resp, body) {
            if (err || resp.statusCode !== 200) {
                logger('Se produjo un error al sacar ' + patrones[1]);
            }

            //Saco el cuerpo
            var $ = cheerio.load(body);

            //Saco la pass
            var pass = $('input#txt_password').attr('value');
            logger("   > Password encontrado: " + pass + " (de " + comprimido.file + ")");

            logger("   > Descomprimo: " + comprimido.file);
            //Descomprimo
            exec('7z x -y -o"' + dir + '" -p' + pass + ' "' + dir + comprimido.file + '"', function (error, stdout, stderr) {
                if (error) {
                    logger(error);
                } else {
                    logger("   > Descomprimido: " + comprimido.file);

                    // Borro el rar
                    fs.unlinkSync(dir + comprimido.file);

                    // Saco el nombre del fichero de video para poder procesarlo luego
                    var videoName;
                    extensionesZip.forEach(function (ext) {
                        if (comprimido.file.endsWith(ext)) {
                            extensionesVideo.forEach(function (ext2) {
                                var fileVideoName = comprimido.file.replace(ext, ext2);

                                //Compruebo si existe
                                if (fs.existsSync(pathTorrents + comprimido.folder + fileVideoName)) {
                                    videoName = fileVideoName;
                                }
                            });
                        }
                    });

                    if (videoName) {
                        comprimido.file = videoName;
                        logger("   > Terminada descompresión: " + comprimido.file);
                        def.resolve({videoFiles: [comprimido], torrentFile: torrentFile});
                    } else {
                        def.reject("Error al descomprimir con contraseña");
                    }

                    // Llamo a continuar el proceso
                    // eventEmitter.emit('unzipFinished', {comprimido: comprimido, file: torrentFile});

                }
            });
        });
    }

    return def.promise;
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
 eventEmitter.on('unzipFinished', function (params) {
 // Parseo de nuevo el torrent
 var data = decodeTorrent(params.file, pathTorrents);

 //Si ha ido mal, borro el torrent y sigo con el siguiente
 if (data === null) {
 fs.unlinkSync(pathTorrents + params.file);
 logger("BORRO torrent, que data es null");
 return;
 } else {
 if (data.zip.length > 0) {
 data.zip.forEach(function (zippo) {
 // Fichero sin extensión
 extensionesZip.forEach(function (ext) {
 if (zippo.file.endsWith(ext)) {
 extensionesVideo.forEach(function (ext2) {
 var fileVideoName = zippo.file.replace(ext, ext2);

 //Compruebo si existe
 if (fs.existsSync(pathTorrents + zippo.folder + fileVideoName)) {
 zippo.file = fileVideoName;
 data.videos.push(zippo);
 }
 });
 }
 });
 });

 }

 eventEmitter.emit('processVideos', {file: params.file, data: data.videos});
 }
 });*/

// eventEmitter.on('processVideos', function (params) {
function moveVideosAndEnd(videos, torrentFile) {
    //Cojo los ficheros de video uno a uno y los muevo
    videos.forEach(function (fichero) {
        //Si la carpeta y fichero origen existen
        logger("   > Miro a ver si existe: " + pathTorrents + fichero.folder + fichero.file);

        var existe = true;
        try {
            fs.accessSync(pathTorrents + fichero.folder + fichero.file);
        } catch (e) {
            logger("   # Error no existe videoFile: " + e);
            existe = false;
        }

        logger("   > Existe: " + existe);

        if (existe) {
            //Lo muevo a la carpeta/temporada/ correspondiente en D:/Videos/Series/
            var oldPath = pathTorrents + fichero.folder + fichero.file,
                newDir = pathVideos + fichero.name,
                newDirTemp = pathVideos + fichero.name + '\\Temporada ' + fichero.season,
                newPath = pathVideos + fichero.name + '\\Temporada ' + fichero.season + '\\';// + video.file;

            //Si tengo el capítulo cambio el nombre del fichero final
            if (fichero.chapter && !isNaN(fichero.chapter)) {
                //Saco la extensión
                var ext = fichero.file.split('.');
                ext = ext[ext.length - 1];

                newPath += fichero.name + ' ' + fichero.season + 'x' + fichero.chapter + '.' + ext;
            } else {
                //Dejo el que venía por defecto
                newPath += fichero.file;
            }

            var moved = true;
            try {
                //Si no existe el nuevo directorio de Serie
                try {
                    fs.accessSync(newDir);
                } catch (e) {
                    logger("   > No existe el directorio de la serie, lo creo");
                    fs.mkdirSync(newDir);
                }

                //Si no existe el nuevo directorio de Temporada
                try {
                    fs.accessSync(newDirTemp);
                } catch (e) {
                    logger("   > No existe el directorio de temporada, lo creo");
                    fs.mkdirSync(newDirTemp);
                }

                fs.renameSync(oldPath, newPath);
            } catch (e2) {
                logger("   # Error al mover: " + e2);
                moved = false;
            }

            //Si todo ha ido bien borro el .torrent y la carpeta origen
            if (moved) {
                logger("   > BORRO torrent, que todo salió ok");
                try {
                    fs.unlinkSync(pathTorrents + torrentFile);
                    //fs.unlinkSync(pathTorrents + video.folder);
                    deleteFolderRecursive(pathTorrents + fichero.folder);

                    //Añado la carpeta al filebot
                    //filebotFolders.push(newDirTemp);
                } catch (e3) {
                    logger("   # Error al borrar torrent y carpetas: " + e3);
                }
            }
        }
    });
}

/*
 filebot -rename "carpeta" -r -non-strict --lang es --db TheTVDB --conflict skip
 */
