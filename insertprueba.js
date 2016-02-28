var request = require('request'),
    cheerio = require('cheerio'),
    mongoose = require('mongoose'),
    md5 = require('md5'),
    async = require('async'),
    Q = require('q'),
    http = require('http');

//Conecto a mongo
mongoose.connect(process.env.OPENSHIFT_MONGODB_DB_URL + process.env.OPENSHIFT_APP_NAME || 'mongodb://localhost/cine', {
    db: {
        safe: true
    }
});

var modelos = require('./models/models.js'),
    urlProvincias = 'http://www.sensacine.com/cines/',
    urlCiudades = 'http://www.sensacine.com/cines/?cgeocode=',
    provincias = [];


var url = 'http://www.ecartelera.com/carteles/9200/9205/002-th.jpg',
    imageFileSizeLimit = 100000,
    noMovieDefaultImage = 'data:image/png;base64,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';


downloadImageAsBase64({imagen: url}, function (err, img) {
    if (err) {
        console.log('error');
        console.log(err);
    } else {
        console.log('OK');
        console.log(img);
    }
});

//Descarga una imagen como base64
function downloadImageAsBase64(movie, callback) {
    console.log("Descargo thumb");
    request(
        {url: movie.imagen, encoding: 'binary'},
        function onImageResponse(error, imageResponse, imageBody) {
            if (error) {
                callback(error);
                //throw error;
            }

            var imageType = imageResponse.headers['content-type'],
                size = imageResponse.headers['content-length'];

            //Compruebo que la imagen no sobrepasa los límites
            if (size > imageFileSizeLimit) {
                console.log('Mu tocha');
                callback(null, noMovieDefaultImage);
            } else {
                var base64 = new Buffer(imageBody, 'binary').toString('base64');
                movie.imagen = 'data:' + imageType + ';base64,' + base64;

                //Devuelvo el objeto movie con la imagen en base 64
                callback(null, movie); // First param indicates error, null=> no error
            }
        }
    );
};


/*console.log(md5("" + 72192) + " deberia ser " + "0d8f90fe332ef3ea3c7f6d3ac53e0b0d");
 console.log(md5("" + 27395) + " deberia ser " + "78157f67ff565a96daa85d723b746e9e");
 console.log(md5("72192") + " deberia ser " + "0d8f90fe332ef3ea3c7f6d3ac53e0b0d");
 console.log(md5("27395") + " deberia ser " + "78157f67ff565a96daa85d723b746e9e");*/
/*
 var events = require('events');
 var eventEmitter = new events.EventEmitter();

 var ringBell = function ringBell(quedices) {
 console.log(quedices);
 };

 eventEmitter.on('doorOpen', ringBell);

 setTimeout(function () {
 eventEmitter.emit('doorOpen', 'patata');
 }, 10000);
 */

/*request.get('http://www.sensacine.com/cines/cines-en-72368', function (err, response, body) {
 if (err) {
 console.error(err);
 } else {
 var fs = require('fs');
 fs.writeFile("tmp/inserteo.html", body, function (err) {
 if (err) {
 return console.log(err);
 }
 console.log("The file was saved!");
 });
 }
 });*/


/*
 modelos.Provincia
 .where({"ciudades._id": "5942aee7804e91cfa9849ddb5ec2a03b"})
 .update({$set: {actualizado: 23}})
 .exec();
 */

/*modelos.Provincia.update({"ciudades._id": "5942aee7804e91cfa9849ddb5ec2a03b"}, {$set: {"ciudades.$.actualizado": 23}}, {}, function (err, affected, raw) {
 if (err) console.log("Error: " + err);
 else {
 console.log(affected);
 console.log(raw);
 }
 });*/

//modelos.Provincia.update({"ciudades._id": "5942aee7804e91cfa9849ddb5ec2a03b"}, {$set: {"ciudades.$.actualizado": 323}}).exec();

/*
 modelos.Provincia.update({"_id": "67f3c822a32053681b2c45736b4da971"}, {$set: {"nombre": "alcachofa"}}, {}, function (err, affected, raw) {
 if (err) console.log("Error: " + err);
 else {
 console.log(affected);
 console.log(raw);
 }
 });
 */

/*
 var sesion = new modelos.Sesion({
 _pelicula: "5e4c0ce8a1b0b2448abd7098086a6df7",
 horario: ["20:20", "20:45"]
 });

 var sesion2 = new modelos.Sesion({
 _pelicula: "01c8f20d17dd4633c1306a24dfe2f841",
 horario: ["10:20", "10:45"]
 });

 var cine = new modelos.Cine({
 _id: "cinecito",
 cineId: "abcd",
 nombre: "Cinexio",
 direccion: "Aqui o alla",
 codigoPostal: 25412,
 sesion: [sesion, sesion2]
 });

 var ciudad = new modelos.Ciudad({
 _id: "987",
 nombre: "Leon",
 cine: [cine]
 });


 var provincia = new modelos.Provincia({
 nombre: "LeonVincia",
 ciudad: [ciudad]
 });

 provincia.save();
 */
//Rescato
/*Cine.find().populate('ciudad.cine.pelicula._pelicula').exec(function (err, cines) {
 console.log(err);
 cines.forEach(function (cine) {
 console.log(cine);
 });
 });*/
/*
 modelos.Provincia.findOne().populate('_pelicula').exec(function (err, cines) {
 console.log(err);
 console.log(cines);
 *//*cines.forEach(function (cine) {
 console.log(cine);
 });
 *//*
 console.log(cines.ciudad);
 console.log(cines.ciudad[0].cine);
 mongoose.disconnect();
 });*/
//populate('_pelicula').

/*
 var pata = iterateUntil(1, 4);
 console.log(pata);

 function iterateUntil(currentValue, endValue) {
 // This line would eventually resolve the promise with something matching
 // the final ending condition.
 return Q.resolve(currentValue)
 .then(function (value) {
 console.log("compruebo: " + value);
 // If the promise was resolved with the loop end condition then you just
 // return the value or something, which will resolve the promise.
 if (value == endValue) return 'OK' + value;

 // Otherwise you call 'iterateUntil' again which will replace the current
 // promise with a new one that will do another iteration.
 else {
 value++;
 return iterateUntil(value, endValue);
 }
 });
 }*/
/*
 console.log(recursive(1));

 function recursive(dato) {
 console.log("Iteración " + dato);
 if (dato === 5) {
 return "OK";
 } else {
 return recursive(++dato);
 }
 }

 par(1, 2);
 par(1);
 par();

 function par(uno, dos) {
 if (uno !== undefined) console.log("uno");
 if (dos !== undefined) console.log("dos");
 }


 $('div.j_entity_container').each(function () {
 var data = $(this).find('h2').nextAll('span.lighten').text();
 console.log(data);

 var patt = /[0-9]{5}/g;
 patt = patt.exec(data);
 if (patt !== null) {
 console.log(parseInt(patt));
 } else {
 }
 });*/